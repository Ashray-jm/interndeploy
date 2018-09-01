const child = require('child_process');
const fs = require('fs');
const {
    shell,
    app
}
= require('electron');
const dataPath = app.getPath('userData');
const regFileW32 = require('./regFileWin');
const path = require('path');
const duti = require('duti-prebuilt');

var notify = () => {
}

var register = {};

register._writeDesktopFile = cb => {
    var powderPath = process.execPath.substr(0,process.execPath.lastIndexOf("/")+1);
    fs.writeFile(dataPath + '/powderweb.desktop', '[Desktop Entry]\n'+
        'Version=1.0\n'+
        'Name=PowderWeb\n'+
        'Comment=Powder Web is a torrent streaming client with a Web UI\n'+
        'Exec=' + process.execPath + ' %U\n'+
        'Path=' + powderPath + '\n'+
        'Icon=' + powderPath + 'icon.png\n'+
        'Terminal=false\n'+
        'Type=Application\n'+
        'MimeType=application/x-bittorrent;x-scheme-handler/magnet;\n'+
        '', cb);
};

register.torrent = () => {
    if (process.platform == 'linux') {
        this._writeDesktopFile(err => {
            if (err) throw err;
            var desktopFile = dataPath+'/powderweb.desktop';
            var tempMime = 'application/x-bittorrent';
            child.exec('gnome-terminal -x bash -c "echo \'Associating Files or URLs with Applications requires Admin Rights\'; echo; sudo echo; sudo echo \'Authentication Successful\'; sudo echo; sudo mv -f '+desktopFile+' /usr/share/applications; sudo xdg-mime default powderweb.desktop '+tempMime+'; sudo gvfs-mime --set '+tempMime+' powderweb.desktop; echo; echo \'Association Complete! Press any key to close ...\'; read" & disown');
        });
    } else if (process.platform == 'darwin') {
        var powderPath = process.execPath.substr(0,process.execPath.lastIndexOf("/")+1)+"../../../../Resources/app.nw/";
        duti('com.electron.powderweb', '.torrent', 'viewer');
    } else {
        var iconPath = process.execPath;
        regFileW32('.torrent', 'powder.web.v1', 'BitTorrent Document', iconPath, [ process.execPath ]);
    }
    notify();
};

register.link = (linkType) => {
    if (process.platform == 'linux') {
        this._writeDesktopFile(err => {
            if (err) throw err;
            var desktopFile = dataPath+'/powderweb.desktop';
            var tempMime = 'x-scheme-handler/' + linkType;
            child.exec('gnome-terminal -x bash -c "echo \'Associating Files or URLs with Applications requires Admin Rights\'; echo; sudo echo; sudo echo \'Authentication Successful\'; sudo echo; sudo mv -f '+desktopFile+' /usr/share/applications; sudo xdg-mime default powderweb.desktop '+tempMime+'; sudo gvfs-mime --set '+tempMime+' powderweb.desktop; echo; echo \'Association Complete! Press any key to close ...\'; read" & disown');
        });
    } else if (process.platform == 'darwin') {
        duti('com.electron.powderweb', linkType);
    } else {
        app.setAsDefaultProtocolClient(linkType);
    }
    notify();
};

module.exports = register;

