#!/bin/bash

# gene smb conf
sed -i 's/%$(PAISMBUSER)/'$PAISMBUSER'/' /etc/samba/smb.conf
sed -i 's/%$(DOMAIN)/'$DOMAIN'/' /etc/samba/smb.conf

# create folders
mkdir -p $SHARE_ROOT/data
mkdir -p $SHARE_ROOT/users

# load nfs modules
modprobe nfs
modprobe nfsd

# join domain
net ads join -U "$DOMAINUSER"%"$DOMAINPWD"

# restart service
service winbind restart
service smbd restart
service rpcbind restart
service nfs-kernel-server restart

useradd "$PAISMBUSER"
(echo "$PAISMBPWD" && echo "$PAISMBPWD") | ./usr/bin/smbpasswd -a "$PAISMBUSER"

sleep infinity
