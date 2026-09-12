' ======================================================================
' سیستەمی سەنگەر زمارەیی و جێگر زمارەیی - Sangar & Jegr Zmarayi POS
' 100% Offline Windows Silent Launcher (VBScript)
' Ensures single node server instance, checks health, logs to logs/server.log
' ======================================================================

Option Explicit
Dim WshShell, fso, currentDir, http, isRunning, i

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' 1. Ensure required folders exist
If Not fso.FolderExists(currentDir & "\data") Then fso.CreateFolder(currentDir & "\data")
If Not fso.FolderExists(currentDir & "\backups") Then fso.CreateFolder(currentDir & "\backups")
If Not fso.FolderExists(currentDir & "\logs") Then fso.CreateFolder(currentDir & "\logs")

' 2. Function to check if server is responsive on /api/health
Function CheckHealth()
    On Error Resume Next
    Dim xmlHttp
    Set xmlHttp = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    If xmlHttp Is Nothing Then
        Set xmlHttp = CreateObject("MSXML2.ServerXMLHTTP")
    End If
    xmlHttp.open "GET", "http://localhost:3000/api/health", False
    xmlHttp.setTimeouts 1000, 1000, 1000, 1000
    xmlHttp.send
    If Err.Number = 0 And xmlHttp.status = 200 Then
        CheckHealth = True
    Else
        CheckHealth = False
    End If
    Set xmlHttp = Nothing
    On Error GoTo 0
End Function

' 3. Check if already running
If Not CheckHealth() Then
    ' Start server silently (0 = hide command window)
    WshShell.Run "cmd.exe /c node server.js >> logs\server.log 2>&1", 0, False
    
    ' Wait up to 10 seconds for health check to pass
    For i = 1 To 10
        WScript.Sleep 1000
        If CheckHealth() Then Exit For
    Next
End If

' 4. Open default web browser at localhost:3000
WshShell.Run "http://localhost:3000"
