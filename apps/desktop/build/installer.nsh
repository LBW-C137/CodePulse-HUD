!macro customUnInstall
  IfFileExists "$INSTDIR\CodePulse HUD.exe" 0 +2
    ExecWait '"$INSTDIR\CodePulse HUD.exe" --cleanup-config'
!macroend
