Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "F:\ICTBD_02\PycharmProjects\parental-screen-tracker"
WshShell.Run """F:\ICTBD_02\PycharmProjects\parental-screen-tracker\.venv\Scripts\pythonw.exe"" ""F:\ICTBD_02\PycharmProjects\parental-screen-tracker\windows_client_entry.py"" --silent", 0, False

