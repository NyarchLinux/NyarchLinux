/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Sergio Costas (rastersoft@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/* exported DBusInterfaces */
'use strict';
var DBusInterfaces = {
    // net.haddes.SwitcherooControl
    'net.hadess.SwitcherooControl': `<node>
    <interface name="net.hadess.SwitcherooControl">
      <property name="HasDualGpu" type="b" access="read"/>
      <property name="NumGPUs" type="u" access="read"/>
      <property name="GPUs" type="aa{sv}" access="read"/>
    </interface>
  </node>`,

    // org.freedesktop.FileManager1
    'org.freedesktop.FileManager1': `<node>
    <interface name='org.freedesktop.FileManager1'>
      <method name='ShowItems'>
        <arg name='URIs' type='as' direction='in'/>
        <arg name='StartupId' type='s' direction='in'/>
      </method>
      <method name='ShowItemProperties'>
        <arg name='URIs' type='as' direction='in'/>
        <arg name='StartupId' type='s' direction='in'/>
      </method>
    </interface>
  </node>`,

    // org.gnome.ArchiveManager1
    'org.gnome.ArchiveManager1': `<node>
    <interface name="org.gnome.ArchiveManager1">
      <method name="GetSupportedTypes">
        <arg name="action" type="s" direction="in"/>
        <arg name="types" type="aa{ss}" direction="out"/>
      </method>
      <method name="AddToArchive">
        <arg name="archive" type="s" direction="in"/>
        <arg name="files" type="as" direction="in"/>
        <arg name="use_progress_dialog" type="b" direction="in"/>
      </method>
      <method name='Compress'>
        <arg name="files" type="as" direction="in"/>
        <arg name="destination" type="s" direction="in"/>
        <arg name="use_progress_dialog" type="b" direction="in"/>
      </method>
      <method name="Extract">
        <arg name="archive" type="s" direction="in"/>
        <arg name="destination" type="s" direction="in"/>
        <arg name="use_progress_dialog" type="b" direction="in"/>
      </method>
      <method name="ExtractHere">
        <arg name="archive" type="s" direction="in"/>
        <arg name="use_progress_dialog" type="b" direction="in"/>
      </method>
      <signal name="Progress">
        <arg name="fraction" type="d"/>
        <arg name="details" type="s"/>
      </signal>
    </interface>
  </node>`,

    // org.gnome.Nautilus.FileOperations2
    'org.gnome.Nautilus.FileOperations2': `<node>
    <interface name='org.gnome.Nautilus.FileOperations2'>
      <method name='CopyURIs'>
        <arg type='as' name='sources' direction='in'/>
        <arg type='s' name='destination' direction='in'/>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <method name='MoveURIs'>
        <arg type='as' name='sources' direction='in'/>
        <arg type='s' name='destination' direction='in'/>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <method name='EmptyTrash'>
        <arg type="b" name="ask_confirmation" direction='in'/>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <method name='TrashURIs'>
        <arg type='as' name='uris' direction='in'/>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <method name='DeleteURIs'>
        <arg type='as' name='uris' direction='in'/>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <method name='CreateFolder'>
        <arg type='s' name='parent_uri' direction='in'/>
        <arg type='s' name='new_folder_name' direction='in'/>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <method name='RenameURI'>
        <arg type='s' name='uri' direction='in'/>
        <arg type='s' name='new_name' direction='in'/>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <method name='Undo'>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <method name='Redo'>
        <arg type='a{sv}' name='platform_data' direction='in'/>
      </method>
      <property name="UndoStatus" type="i" access="read"/>
    </interface>
  </node>`,

    // org.gnome.NautilusPreviewer
    'org.gnome.NautilusPreviewer': `<node>
    <interface name='org.gnome.NautilusPreviewer'>
      <method name='ShowFile'>
        <arg name='FileUri' type='s' direction='in'/>
        <arg name='ParentXid' type='i' direction='in'/>
        <arg name='CloseIfShown' type='b' direction='in'/>
      </method>
    </interface>
  </node>`,

    // org.gtk.vfs.Metadata
    'org.gtk.vfs.Metadata': `<node>
    <interface name='org.gtk.vfs.Metadata'>
      <method name="Set">
        <arg type='ay' name='treefile' direction='in'/>
        <arg type='ay' name='path' direction='in'/>
        <arg type='a{sv}' name='data' direction='in'/>
      </method>
      <method name="Remove">
        <arg type='ay' name='treefile' direction='in'/>
        <arg type='ay' name='path' direction='in'/>
      </method>
      <method name="Move">
        <arg type='ay' name='treefile' direction='in'/>
        <arg type='ay' name='path' direction='in'/>
        <arg type='ay' name='dest_path' direction='in'/>
      </method>
      <method name="GetTreeFromDevice">
        <arg type='u' name='major' direction='in'/>
        <arg type='u' name='minor' direction='in'/>
        <arg type='s' name='tree' direction='out'/>
      </method>
      <signal name="AttributeChanged">
        <arg type='s' name='tree_path'/>
        <arg type='s' name='file_path'/>
      </signal>
    </interface>
  </node>`,

    // org.freedesktop.DBus.Introspectable
    'org.freedesktop.DBus.Introspectable': `<node>
    <interface name="org.freedesktop.DBus.Introspectable">
      <method name="Introspect">
        <arg direction="out" type="s"/>
      </method>
    </interface>
  </node>`,

    // org.freedesktop.Notifications
    'org.freedesktop.Notifications': `<node>
  <interface name="org.freedesktop.Notifications">
    <method name="Notify">
      <arg type="s" name="arg_0" direction="in">
      </arg>
      <arg type="u" name="arg_1" direction="in">
      </arg>
      <arg type="s" name="arg_2" direction="in">
      </arg>
      <arg type="s" name="arg_3" direction="in">
      </arg>
      <arg type="s" name="arg_4" direction="in">
      </arg>
      <arg type="as" name="arg_5" direction="in">
      </arg>
      <arg type="a{sv}" name="arg_6" direction="in">
      </arg>
      <arg type="i" name="arg_7" direction="in">
      </arg>
      <arg type="u" name="arg_8" direction="out">
      </arg>
    </method>
    <method name="CloseNotification">
      <arg type="u" name="arg_0" direction="in">
      </arg>
    </method>
    <method name="GetCapabilities">
      <arg type="as" name="arg_0" direction="out">
      </arg>
    </method>
    <method name="GetServerInformation">
      <arg type="s" name="arg_0" direction="out">
      </arg>
      <arg type="s" name="arg_1" direction="out">
      </arg>
      <arg type="s" name="arg_2" direction="out">
      </arg>
      <arg type="s" name="arg_3" direction="out">
      </arg>
    </method>
    <signal name="NotificationClosed">
      <arg type="u" name="arg_0">
      </arg>
      <arg type="u" name="arg_1">
      </arg>
    </signal>
    <signal name="ActionInvoked">
      <arg type="u" name="arg_0">
      </arg>
      <arg type="s" name="arg_1">
      </arg>
    </signal>
  </interface>
</node>`,
};
