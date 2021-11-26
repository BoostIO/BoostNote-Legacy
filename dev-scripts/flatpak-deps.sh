#!/bin/sh
# Installs flatpak dependencies used by ′electron-installer-flatpak′
flatpak install flathub org.freedesktop.Sdk/x86_64/1.6 -y
flatpak install flathub org.freedesktop.Platform/x86_64/1.6 -y
flatpak install flathub org.electronjs.Electron2.BaseApp/x86_64/stable -y
