!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var DesktopShortcutCheckbox
Var StartMenuShortcutCheckbox

Var CreateDesktopShortcut
Var CreateStartMenuShortcut

!macro customWelcomePage
    !insertmacro MUI_PAGE_WELCOME

    Page Custom ShortcutPage ShortcutPageLeave
!macroend

Function ShortcutPage
    nsDialogs::Create 1018
    Pop $0

    ${NSD_CreateLabel} 0 0 100% 20u \
        "Choose which shortcuts should be created."
    Pop $1

    ${NSD_CreateCheckbox} 0 30u 100% 12u \
        "Create Desktop Shortcut"
    Pop $DesktopShortcutCheckbox

    ${NSD_Check} $DesktopShortcutCheckbox

    ${NSD_CreateCheckbox} 0 50u 100% 12u \
        "Create Start Menu Shortcut"
    Pop $StartMenuShortcutCheckbox

    ${NSD_Check} $StartMenuShortcutCheckbox

    nsDialogs::Show
FunctionEnd

Function ShortcutPageLeave
    ${NSD_GetState} $DesktopShortcutCheckbox $CreateDesktopShortcut
    ${NSD_GetState} $StartMenuShortcutCheckbox $CreateStartMenuShortcut
FunctionEnd

!macro customInstall

    ${If} $CreateDesktopShortcut == ${BST_CHECKED}
        CreateShortcut \
            "$DESKTOP\\${PRODUCT_NAME}.lnk" \
            "$INSTDIR\\${APP_EXECUTABLE_FILENAME}"
    ${EndIf}

    ${If} $CreateStartMenuShortcut == ${BST_CHECKED}
        CreateDirectory \
            "$SMPROGRAMS\\${PRODUCT_NAME}"

        CreateShortcut \
            "$SMPROGRAMS\\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk" \
            "$INSTDIR\\${APP_EXECUTABLE_FILENAME}"
    ${EndIf}

!macroend

!macro customUnInstall

    Delete "$DESKTOP\\${PRODUCT_NAME}.lnk"

    Delete "$SMPROGRAMS\\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk"

    RMDir "$SMPROGRAMS\\${PRODUCT_NAME}"

!macroend