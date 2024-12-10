# $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
# Set-Location -Path $scriptDirectory

# $buildScript = $scriptDirectory + '\build.ps1'

# $newProcess = Start-Process -FilePath "powershell.exe" -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "' + $buildScript + '"') -Verb RunAs

# $newProcess.WaitForExit()

# if($newProcess.ExitCode -eq 0){
#     ./install.ps1
# }
