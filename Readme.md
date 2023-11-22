The "GD CLI Tools" is a software development kit designed to deliver secure and efficient data management.
It works only with client-side encrypted files, so you need to provide your mnemonic. The mnemonic only used locally and never sent to Ghostdrive servers. 



## Installation and configuration
1. Make sure you have mnemonic of wallet attached to your GhostDrive account.
You may create new mnemonic and attach additional wallet to your account using ghostdrive.com portal.
2. Obtain your key and secret from GhostDrive developers portal.
3. Prepare .env file based on .env.example
4. Install GD CLI Tools

```
// install
npm install -g gd-cli

// Provide your key, secret and wallet mnemonic. 
gd configure
```


## Usage

### Download and upload file

```
gd cp <from> <to>
gd cp gd://workspaceAlias/folder/file.txt /tmp/file.txt // download
gd cp /tmp/file.txt gd://workspaceAlias/folder/file.txt // upload
```

### List my workspaces
```
gd list-workspaces
```

### List files in workspace
```
gd ls <folderPath>
gd ls gd://workspaceAlias/folder
```

### Trash the file
```
gd rm <folderPath>
gd rm gd://workspaceAlias/folder/file.txt
```

### List available wallets of your mnemonic
```
gd wallet
```


## Architecture diagram
```
@startuml
actor User

package "GD CLI Tools" {
  component CLI #LightGreen
  component Authentication #LightGreen
  component "Keys management" #LightGreen
  
  component "s3-alike daemon" #LightBlue
}

component backend {
}

component GDGateway {
}

Authentication ..> backend : <<uses>>
"Keys management" ..> backend : <<uses>>
CLI ..> GDGateway : <<uses>>
CLI ..> Authentication : <<uses>>
CLI ..> "Keys management" : <<uses>>
"s3-alike daemon" ..> "Keys management" : <<uses>>
"s3-alike daemon" ..> Authentication : <<uses>>
"s3-alike daemon" ..> GDGateway : <<uses>>

User --> CLI
User --> "s3-alike daemon"
@enduml
```


Diagram:
![](https://cdn-0.plantuml.com/plantuml/png/dP91IyGm48Nlyok6UkvUlCbILYqKsRs9Fs1CXsvfCrcQ2R8i_dS9eYLfY-0nUT_alGplu9Kc3NO4CkecVFCy0Lp83DGn5asDh_Mnm1iW6cSlJbWKdqylU7VgkxCs4xCascFGCulsXhHtieaLHxvwj2JKiMNH8YDJsD-NDFO3OqjidVp0JsDW-0IOoNSo0qkBj_IwgHjI_g3hjv1btEsgty47tE-3PrzLi8Yu1SPrH6bsMH4ppnLYuPU4oLVmtv4ynn_y-gSWrWJBiefLc0-B5-30qWOxVW40)

