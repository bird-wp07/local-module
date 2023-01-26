# Change into the directory containing this script for constistent execution
# irrspective of the working directory from where this script is run.
Set-Location $PSScriptRoot

$LOCAL_MODULE_PORT = Get-Content .\CONFIG | Select-String "^LOCAL_MODULE_PORT=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
$DSS_PORT = Get-Content .\CONFIG | Select-String "^DSS_PORT=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}

# Constants
# ---------

# Path of the standalone node root directory extracted from the archive.
# Contains, among other files, the 'node.exe' and 'npm' executables.
$nodeBinPath = ".\node-v18.12.1-win-x64"

# Path of the dss root directory extracted from the archive. Contains, among
# other files, the 'Webapp-Startup.bat' and 'Webapp-Shutdown.bat' batch files.
$dssRootPath = ".\dss-demo-bundle-5.11"
$dssPidFileName = "dss.pid"

# Path of the local module installed via
#
#     npm i --prefix <PREFIX> @bird-wp07/local-module
#
# Contains 'package.json', 'package-lock.json' and 'node_modules/.'
$localModulePath = ".\local-module"

# Path of the apache server's configuration file.
$serverConfigPath = "$dssRootPath\apache-tomcat-8.5.82\conf\server.xml"

# Downloads
$nodeUrl = "https://nodejs.org/dist/v18.12.1/node-v18.12.1-win-x64.zip"
$nodeZipFileName = ".\node-standalone-v18.12.1-win-x64.zip"
$dssUrl = "https://github.com/bird-wp07/dss-demonstrations/releases/download/5.11/dss-demo-bundle-5.11.zip"
$dssZipFileName = ".\dss-standalone-v5.11.zip"

# Control the [x] button of the Powershell window, in order to guarantee cleanup. See
#
#     https://stackoverflow.com/questions/73746912
function Set-XButton {
    #Calling user32.dll methods for Windows and Menus
    $MethodsCall = '
    [DllImport("user32.dll")] public static extern long GetSystemMenu(IntPtr hWnd, bool bRevert);
    [DllImport("user32.dll")] public static extern bool EnableMenuItem(long hMenuItem, long wIDEnableItem, long wEnable);
    [DllImport("user32.dll")] public static extern long SetWindowLongPtr(long hWnd, long nIndex, long dwNewLong);
    [DllImport("user32.dll")] public static extern bool EnableWindow(long hWnd, int bEnable);
    '

    $SC_CLOSE = 0xF060
    $MF_DISABLED = 0x00000002L
    $MF_ENABLED = 0x00000000L

    #Create a new namespace for the Methods to be able to call them
    Add-Type -MemberDefinition $MethodsCall -name NativeMethods -namespace Win32

    $PSWindow = Get-Process -Pid $PID
    $hwnd = $PSWindow.MainWindowHandle

    #Get System menu of windows handled
    $hMenu = [Win32.NativeMethods]::GetSystemMenu($hwnd, 0)

    if ($args[0] -eq "0") {
        $state = $MF_DISABLED
    }
    else {
        $state = $MF_ENABLED
    }
    [Win32.NativeMethods]::EnableMenuItem($hMenu, $SC_CLOSE, $state) | Out-Null
}

function Start-DSS {
    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    [xml]$cfg = Get-Content $serverConfigPath
    $cfg.Server.Service.Connector.port = "$DSS_PORT"
    $cfg.Save((Resolve-Path $serverConfigPath)) # Writeback requires abspath

    # Run the included startup batch file from its own directory.
    Push-Location $dssRootPath
    $env:JRE_HOME = ".\java"
    $env:CATALINA_HOME = ".\apache-tomcat-8.5.82"
    $process = Start-Process -FilePath cmd.exe -ArgumentList "/c", ".\apache-tomcat-8.5.82\bin\catalina.bat run" `
        -RedirectStandardError "NUL" -RedirectStandardOut "..\NUL" -NoNewWindow
    #                           ^^^~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^~~~~~~~~~~~~~~ lol, windows
    # See https://stackoverflow.com/questions/49375418
    Write-Output $process.ID >dss.pid
    Pop-Location
}

# Kill running DSS servers via PID. This is a hack to solve the problem of the
# included shutdown batch file not working properly unless the dss server has
# fully finished its boot sequence.
function Stop-DSS {
    Push-Location $dssRootPath
    $dssPid = Get-Content -File dss.pid
    Pop-Location
}

# If needed, downloads missing dependencies (dss, standalone node, local
# module). Whether a dependency needs to be downloaded is asserted from the
# existence of the respective directory (dss, local module and node root
# directory).
#
# The contents of a directory, if it exists, are not further inspected. In
# order to issue a full re-download of a component delete its directory.
function Install-Dependencies ($what, $lmver = "latest") {
    if (($what -eq "node") -or ($what -eq "all")) {
        if (Test-Path -Path $nodeBinPath) {
            Write-Output "Standalone nodejs distribution found at '$nodeBinPath'."
        }
        else {
            Write-Output "Standalone nodejs distribution not found at '$nodeBinPath'. Starting download ..."
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZipFileName
            Write-Output "Extracting archive ..."
            Expand-Archive -Path $nodeZipFileName -DestinationPath .
        }
    }

    if (($what -eq "dss") -or ($what -eq "all")) {
        if (Test-Path -Path $dssRootPath) {
            Write-Output "DSS installation found at '$dssRootPath'."
        }
        else {
            Write-Output "Dss installation not found at '$dssRootPath'. Starting download ..."
            Invoke-WebRequest -Uri $dssUrl -OutFile $dssZipFileName
            Write-Output "Extracting archive ..."
            Expand-Archive -Path $dssZipFileName -DestinationPath .
        }
    }

    if (($what -eq "local-module") -or ($what -eq "all")) {
        if (Test-Path -Path $localModulePath) {
            Write-Output "Local module installation found at '$localModulePath'."
        }
        else {
            Write-Output "Local module installation not found at '$localModulePath'. Starting download ..."
            if ($lmver -eq "latest") {
                $suffix = "latest"
            } else {
                $suffix = "tags/$lmver"
            }
            $lmurl = "https://api.github.com/repos/bird-wp07/local-module/releases/$suffix"
            $zipBallUrl = Invoke-WebRequest -Uri $lmurl -ContentType "application/json" -Method Get -UseBasicParsing |
                Select-Object -Expand Content |
                ConvertFrom-Json |
                Select-Object -Expand zipball_url
            Invoke-WebRequest -Uri $zipballUrl -OutFile lm.zip
            Expand-Archive -Path lm.zip -DestinationPath $localModulePath

            # Remove subdirectory in archive (equivalent of tar --strip-components 1).
            $subdirName = Get-ChildItem -Path $localModulePath |
                Select-Object -first 1 |
                Select-Object -Expand Name
            Copy-Item -Recurse "$localModulePath\$subdirName\*" -Destination "$localModulePath"
            Remove-Item -Recurse "$localModulePath\$subdirName"

            # Prepend the nodejs binary abspath to PATH to guarantee that our installed
            # nodejs is used.
            $nodeBin = Resolve-Path $nodeBinPath
            $env:Path = "$($nodeBin);$($env:Path)"
            Push-Location $localModulePath
            npm install
            npm run build-windows
            Pop-Location
        }
    }
}

function main {
    $version = $(Get-Content -Path VERSION)
    Install-Dependencies all $version

    # Prepend the nodejs binary abspath to PATH to guarantee that our installed
    # nodejs is used.
    $nodeBin = Resolve-Path $nodeBinPath
    $env:Path = "$($nodeBin);$($env:Path)"

    try {
        # Start DSS in the background in a separate cmd.exe window.
        Set-XButton 0
        Start-DSS

        # Start the local module's http server.
        $env:WP07_LOCAL_MODULE_BASEURL = "http://127.0.0.1:$LOCAL_MODULE_PORT"
        $env:WP07_DSS_BASEURL = "http://127.0.0.1:$DSS_PORT"
        Push-Location $localModulePath
        npm run start-windows
        Pop-Location
    }
    finally {
        # Finally ensures cleanup even if the script was killed via ctrl-c.
        Stop-DSS

        # Reactive [x] button and return to original directory.
        Set-XButton 1
        Set-Location $rootDir
    }
}

Switch ($args[0]) {
    stop-dss { Stop-DSS }
    start-dss { Start-DSS }
    install-dependencies { Install-Dependencies $args[1] $(Get-Content -Path VERSION) }
    default { main }
}