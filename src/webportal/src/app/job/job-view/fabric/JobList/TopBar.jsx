// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
// to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import React, { useContext, useState, useEffect } from 'react';
import {
  getTheme,
  ColorClassNames,
  CommandBar,
  CommandBarButton,
  SearchBox,
  Stack,
} from 'office-ui-fabric-react';

import Context from './Context';
import Filter from './Filter';
import { getStatusText } from './utils';

import webportalConfig from '../../../../config/webportal.config';
import FilterButton from './FilterButton';

const token = cookies.get('token');

function KeywordSearchBox() {
  const { filter, setFilter } = useContext(Context);
  function onKeywordChange(keyword) {
    const { users, virtualClusters, statuses } = filter;
    setFilter(new Filter(keyword, users, virtualClusters, statuses));
  }

  /** @type {import('office-ui-fabric-react').IStyle} */
  const rootStyles = {
    backgroundColor: 'transparent',
    alignSelf: 'center',
    width: 220,
  };
  return (
    <SearchBox
      underlined
      placeholder='Filter by keyword'
      styles={{ root: rootStyles }}
      value={filter.keyword}
      onChange={onKeywordChange}
    />
  );
}

function TopBar() {
  const [active, setActive] = useState(true);
  const [users, setUser] = useState(Object.create(null));
  const [virtualClusters, setVirtualClusters] = useState(Object.create(null));

  const statuses = {
    Waiting: true,
    Succeeded: true,
    Running: true,
    Stopped: true,
    Failed: true,
  };

  const { refreshJobs, selectedJobs, stopJob, filter, setFilter } = useContext(
    Context,
  );

  useEffect(() => {
    fetch(`${webportalConfig.restServerUri}/api/v2/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(response => {
        return response.json();
      })
      .then(body => {
        const allUsers = Object.create(null);
        body.forEach(userBody => {
          allUsers[userBody.username] = true;
        });
        setUser(allUsers);
      })
      .catch(err => {
        alert(err.message);
      });

    fetch(`${webportalConfig.restServerUri}/api/v2/virtual-clusters`)
      .then(response => {
        return response.json();
      })
      .then(body => {
        const allVirtualClusters = Object.create(null);
        for (const virtualCluster of Object.keys(body)) {
          allVirtualClusters[virtualCluster] = true;
        }
        setVirtualClusters(allVirtualClusters);

        const allValidVC = Object.keys(body);
        const { keyword, users, virtualClusters, statuses } = filter;
        const filterVC = new Set(
          allValidVC.filter(vc => virtualClusters.has(vc)),
        );
        setFilter(new Filter(keyword, users, filterVC, statuses));
      })
      .catch(err => {
        alert(err.message);
      });
  }, [filter, setFilter]);

  /**
   * @returns {import('office-ui-fabric-react').ICommandBarItemProps}
   */
  function getStop() {
    return {
      key: 'stop',
      name: 'Stop',
      buttonStyles: {
        root: { backgroundColor: 'transparent', height: '100%' },
        icon: { fontSize: 14 },
      },
      iconProps: {
        iconName: 'StopSolid',
      },
      onClick() {
        stopJob(...selectedJobs);
      },
    };
  }

  /**
   * @returns {import('office-ui-fabric-react').ICommandBarItemProps}
   */
  function getNew() {
    return {
      key: 'new',
      name: 'New',
      buttonStyles: {
        root: { backgroundColor: 'transparent', height: '100%' },
      },
      iconProps: {
        iconName: 'Add',
      },
      href: '/submit.html',
    };
  }

  /**
   * @returns {import('office-ui-fabric-react').ICommandBarItemProps}
   */
  function getRefresh() {
    return {
      key: 'refresh',
      name: 'Refresh',
      buttonStyles: {
        root: { backgroundColor: 'transparent', height: '100%' },
      },
      iconProps: {
        iconName: 'Refresh',
      },
      onClick: refreshJobs,
    };
  }

  /**
   * @returns {import('office-ui-fabric-react').ICommandBarItemProps}
   */
  function getFilters() {
    return {
      key: 'filters',
      name: 'Filters',
      iconProps: { iconName: 'Filter' },
      menuIconProps: { iconName: active ? 'ChevronUp' : 'ChevronDown' },
      onClick() {
        setActive(!active);
      },
      onRender(item) {
        return (
          <CommandBarButton
            onClick={item.onClick}
            iconProps={item.iconProps}
            menuIconProps={item.menuIconProps}
            styles={{ root: { backgroundColor: 'transparent' } }}
          >
            Filter
          </CommandBarButton>
        );
      },
    };
  }

  const ableStop =
    selectedJobs.length > 0 &&
    selectedJobs.every(job => {
      return (
        getStatusText(job) === 'Waiting' || getStatusText(job) === 'Running'
      );
    });

  const topBarItems = [ableStop ? getStop() : getNew(), getRefresh()];
  const topBarFarItems = [getFilters()];

  const { spacing } = getTheme();

  return (
    <React.Fragment>
      <CommandBar
        items={topBarItems}
        farItems={topBarFarItems}
        styles={{ root: { backgroundColor: 'transparent', padding: 0 } }}
      />
      {active && (
        <Stack
          horizontal
          verticalAlign='stretch'
          horizontalAlign='space-between'
          styles={{
            root: [
              ColorClassNames.neutralLightBackground,
              {
                marginTop: spacing.s2,
                padding: spacing.m,
              },
            ],
          }}
        >
          <KeywordSearchBox />
          <Stack horizontal>
            <FilterButton
              styles={{ root: { backgroundColor: 'transparent' } }}
              text='User'
              iconProps={{ iconName: 'Contact' }}
              items={Object.keys(users)}
              selectedItems={Array.from(filter.users)}
              onSelect={users => {
                const { keyword, virtualClusters, statuses } = filter;
                setFilter(
                  new Filter(
                    keyword,
                    new Set(users),
                    virtualClusters,
                    statuses,
                  ),
                );
              }}
              searchBox
              clearButton
            />
            <FilterButton
              styles={{ root: { backgroundColor: 'transparent' } }}
              text='Virtual Cluster'
              iconProps={{ iconName: 'CellPhone' }}
              items={Object.keys(virtualClusters)}
              selectedItems={Array.from(filter.virtualClusters)}
              onSelect={virtualClusters => {
                const { keyword, users, statuses } = filter;
                setFilter(
                  new Filter(
                    keyword,
                    users,
                    new Set(virtualClusters),
                    statuses,
                  ),
                );
              }}
              clearButton
            />
            <FilterButton
              styles={{ root: { backgroundColor: 'transparent' } }}
              text='Status'
              iconProps={{ iconName: 'Clock' }}
              items={Object.keys(statuses)}
              selectedItems={Array.from(filter.statuses)}
              onSelect={statuses => {
                const { keyword, users, virtualClusters } = filter;
                setFilter(
                  new Filter(
                    keyword,
                    users,
                    virtualClusters,
                    new Set(statuses),
                  ),
                );
              }}
              clearButton
            />
            <CommandBarButton
              styles={{
                root: { backgroundColor: 'transparent', height: '100%' },
              }}
              iconProps={{ iconName: 'Cancel' }}
              onClick={() => setFilter(new Filter())}
            />
          </Stack>
        </Stack>
      )}
    </React.Fragment>
  );
}

export default TopBar;
