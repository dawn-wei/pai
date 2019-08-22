#!/usr/bin/env python
# Copyright (c) Microsoft Corporation
# All rights reserved.
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
# documentation files (the "Software"), to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
# to permit persons to whom the Software is furnished to do so, subject to the following conditions:
# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
# BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
# DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

from __future__ import print_function

import os
import sys
import collections
import logging
import argparse
import json
import yaml
import subprocess
import re

logger = logging.getLogger(__name__)

def run_script(script_path, parameters, plugin_scripts):
    args = [script_path, "{}".format(parameters)]
    args += plugin_scripts
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    while True:
        line = proc.stdout.readline()
        if not line:
            break
        line = line.encode("UTF-8").strip()
        logger.info(line)
    proc.wait()
    if proc.returncode:
        logger.error("failed to run %s, error code is %s", script_path, proc.returncode)


def init_deployment(jobconfig, commands, taskrole):
    """Inject preCommands and postCommands form deployment.

    Args:
        jobconfig: Jobconfig object generated by praser.py from framework.json.
        commands: Commands to call in precommands.sh and postcommands.sh
    """
    
    if "defaults" not in jobconfig or "deployments" not in jobconfig or "deployment" not in jobconfig["defaults"]:
        logger.info("No suitable deployment found in jobconfig. Skipping")
        return None
    else:
        deployment_name = jobconfig["defaults"]["deployment"]
        for deployment in jobconfig["deployments"]:
            if deployment["name"] == deployment_name and taskrole in deployment["taskRoles"]:
                # Inject preCommands and postCommands
                if "preCommands" in deployment["taskRoles"][taskrole]:
                    commands[0].append("\n".join(deployment["taskRoles"][taskrole]["preCommands"]))
                if "postCommands" in deployment["taskRoles"][taskrole]:    
                    commands[1].insert(0, "\n".join(deployment["taskRoles"][taskrole]["postCommands"]))


def init_plugins(jobconfig, commands, base_dir, taskrole):
    """Init plugins from jobconfig.

    Args:
        jobconfig: Jobconfig object generated by praser.py from framework.json.
        commands: Commands to call in precommands.sh and postcommands.sh
        base_dir: The parent path for init.d, plugins and runtime.d
    """

    for index in range(len(jobconfig["extras"]["com.microsoft.pai.runtimeplugin"])):
        plugin = jobconfig["extras"]["com.microsoft.pai.runtimeplugin"][index]
        # Check taskroles
        if "taskroles" in plugin and taskrole not in plugin["taskroles"]:
            continue

        plugin_name = plugin["plugin"]
        plugin_base_path = "{}/plugins/{}".format(base_dir, plugin_name)

        parameters = replace_ref(str(plugin.get("parameters", "")), jobconfig, taskrole)

        with open("{}/desc.yaml".format(plugin_base_path), "r") as f:
            plugin_desc = yaml.load(f)

        plugin_scripts = ["{}/runtime.d/plugin_pre{}.sh".format(base_dir, index), "{}/runtime.d/plugin_post{}.sh".format(base_dir, index)]

        # Run init script
        if "init-script" in plugin_desc:
            run_script("{}/{}".format(plugin_base_path, plugin_desc["init-script"]), parameters, plugin_scripts)        

        if os.path.isfile(plugin_scripts[0]):
            commands[0].append("/bin/bash {}".format(plugin_scripts[0]))

        if os.path.isfile(plugin_scripts[1]):
            commands[1].insert(0, "/bin/bash {}".format(plugin_scripts[1]))


def replace_ref(param_str, jobconfig, taskrole):
    def _find_ref(matched):
        ref_str = re.sub(r'(\s*)%>', "", re.sub(r'<%(\s*)\$', "", matched.group(0)))
        ref = ref_str.split(".")   
        if ref[0] in ["parameters", "secrets"]:
            cur_element = jobconfig[ref[0]]
        elif ref[0] in ["script", "output", "data"]:
            cur_element = next(b for b in jobconfig["prerequisites"] if b["type"] == ref[0] and b["name"] == jobconfig["taskRoles"][taskrole][ref[0]])
        for i in range(1, len(ref)):
            list_indexes = re.findall(r'([\s\S]*?)\[(\s*)([0-9]+)(\s*)\]', ref[i])
            if len(list_indexes) == 0:
                cur_element = cur_element[ref[i]]   
            else:
                for list_index in list_indexes:
                    if list_index[0]:
                        cur_element = cur_element[list_index[0]]
                    cur_element = cur_element[int(list_index[2])]
        return cur_element

    replaced = re.sub(r'<%(\s*)\$([\s\S]*?)(\s*)%>', _find_ref, param_str)
    return replaced


if __name__ == "__main__":
    logging.basicConfig(
        format="%(asctime)s - %(levelname)s - %(filename)s:%(lineno)s - %(message)s",
        level=logging.INFO,
    )
    parser = argparse.ArgumentParser()
    parser.add_argument("jobconfig_yaml", help="jobConfig.yaml generated by parser.py from framework.json")
    parser.add_argument("base_dir", help="pai base dir")
    parser.add_argument("task_role", help="container task role name")
    args = parser.parse_args()

    logger.info("loading yaml from %s", args.jobconfig_yaml)
    with open(args.jobconfig_yaml) as j:
        jobconfig = yaml.load(j)

    commands = [[], []]
    init_plugins(jobconfig, commands, args.base_dir, args.task_role)
    
    # pre-commands and post-commands already handled by rest-server. Don't need to do this unless use commands in JobConfig for comments compatibility.
    # init_deployment(jobconfig, commands)

    with open("{}/runtime.d/precommands.sh".format(args.base_dir), "a+") as f:
        f.write("\n".join(commands[0]))

    with open("{}/runtime.d/postcommands.sh".format(args.base_dir), "a+") as f:
        f.write("\n".join(commands[1]))
