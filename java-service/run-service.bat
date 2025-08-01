@echo off
echo 🧘 Starting Zen QA Java Service...

REM Get all JAR files from target/dependency
set CLASSPATH=target/classes
for %%i in (target/dependency/*.jar) do (
    set CLASSPATH=!CLASSPATH!;%%i
)

echo Using classpath: %CLASSPATH%

REM Run the application
java -cp "%CLASSPATH%" com.zenqa.ZenQAService

pause
