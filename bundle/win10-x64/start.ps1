# ######################
# ADMINISTRATOR SETTINGS
# ######################
$LOCAL_MODULE_PORT = 2048
$DSS_PORT = 8080
$DEBUG = 0

# Constants
$nodeBinPath = ".\node-v18.12.1-win-x64"
$dssRootPath = ".\dss-demo-bundle-5.11.1"
$serverConfigPath = "$dssRootPath\apache-tomcat-8.5.82\conf\server.xml"

# Change into the directory containing this script for constistent execution
# irrspective of the working directory from where this script is run.
$rootDir = Split-Path $MyInvocation.MyCommand.Path
Set-Location $rootDir

# HACK: Disables the pwsh window's [x] button to guarantee that cleanup is
#       performed. See
#
#           https://stackoverflow.com/questions/73746912/disable-the-close-x-button-in-powershell
function Disable-X {
    #Calling user32.dll methods for Windows and Menus
    $MethodsCall = '
    [DllImport("user32.dll")] public static extern long GetSystemMenu(IntPtr hWnd, bool bRevert);
    [DllImport("user32.dll")] public static extern bool EnableMenuItem(long hMenuItem, long wIDEnableItem, long wEnable);
    [DllImport("user32.dll")] public static extern long SetWindowLongPtr(long hWnd, long nIndex, long dwNewLong);
    [DllImport("user32.dll")] public static extern bool EnableWindow(long hWnd, int bEnable);
    '

    $SC_CLOSE = 0xF060
    $MF_DISABLED = 0x00000002L

    #Create a new namespace for the Methods to be able to call them
    Add-Type -MemberDefinition $MethodsCall -name NativeMethods -namespace Win32

    $PSWindow = Get-Process -Pid $PID
    $hwnd = $PSWindow.MainWindowHandle

    #Get System menu of windows handled
    $hMenu = [Win32.NativeMethods]::GetSystemMenu($hwnd, 0)

    #Disable X Button
    [Win32.NativeMethods]::EnableMenuItem($hMenu, $SC_CLOSE, $MF_DISABLED) | Out-Null
}

function Start-DSS {
    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    $content = Get-Content $serverConfigPath
    $lineNr = ($content | Select-String "<!-- ====").LineNumber # pwsh's indexing is off-by-one -_-
    $buffer = $content[$lineNr] -replace 'port="[^"]*"', "port=`"$DSS_PORT`""
    $content[$lineNr] = $buffer
    Set-Content $serverConfigPath $content

    # Run the included startup batch file from its own directory. Depdending on
    # the debug setting, show or hide the dss cmd.exe window.
    Push-Location $dssRootPath
    $env:JRE_HOME = ".\java"
    $env:CATALINA_HOME = ".\apache-tomcat-8.5.82"
    if ($DEBUG -eq 1) {
        Start-Process -FilePath cmd.exe -ArgumentList "/c", ".\apache-tomcat-8.5.82\bin\catalina.bat run"
    }
    else {
        Start-Process -FilePath cmd.exe -ArgumentList "/c", ".\apache-tomcat-8.5.82\bin\catalina.bat run" `
            -RedirectStandardError "NUL" -RedirectStandardOut "..\NUL" -NoNewWindow
        #                           ^^^~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^~~~~~~~~~~~~~~ lol, windows
        # See https://stackoverflow.com/questions/49375418/start-process-redirect-output-to-null
    }
    Pop-Location
}

# Kill running DSS servers by eliminating processes whose commandlines match
# our use case. This is a hack to solve the problem of the included shutdown
# batch file not working properly unless the dss server has fully finished its
# boot sequence.
function Stop-DSS {
    $query = ( "Select * from win32_Process where " +
        "(ExecutablePath like '%dss-demo-bundle-5.11.1\\java\\bin\\java.exe') and " +
        "(CommandLine like '%org.apache.catalina.startup.Bootstrap%')" )
    $results = Get-WmiObject -Query $query
    foreach ($result in $results) {
        Stop-Process $result.handle
    }
}

function main {
    Disable-X

    # Prepend the nodejs binary abspath to PATH to guarantee that our installed
    # nodejs is used.
    $nodeBin = Resolve-Path $nodeBinPath
    $env:Path = "$($nodeBin);$($env:Path)"

    try {
        # Start DSS in the background in a separate cmd.exe window.
        Start-DSS

        # Start the local module's http server.
        $env:WP07_LOCAL_MODULE_PORT = $LOCAL_MODULE_PORT
        $env:WP07_DSS_BASE_URL = "http://127.0.0.1:$DSS_PORT"
        npx "@bird-wp07/local-module"
    }
    finally {
        # Finally ensures cleanup even if the script was ungracefully killed
        # (e.g. ctrl-c). Finally does not work if we close the windows via the
        # [x] button (see HACK above).
        Stop-DSS

        # TODO: Enable [x] button after shutdown.
    }
}

Switch ($args[0]) {
    stop-dss { Stop-DSS }
    start-dss { Start-DSS }
    default { main }
}