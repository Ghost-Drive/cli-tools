The "GD SDK" is a software development kit designed to deliver secure and efficient data management and user authentication. Its Command Line Interface (CLI) and "s3-alike daemon" provide user interaction and seamless integration with existing s3 connected software. The Authentication and "Keys Management" components ensure secure access to the system, further enhancing its reliability and robustness for user operations.

Diagram:
![](https://cdn-0.plantuml.com/plantuml/png/dP91IyGm48Nlyok6UkvUlCbILYqKsRs9Fs1CXsvfCrcQ2R8i_dS9eYLfY-0nUT_alGplu9Kc3NO4CkecVFCy0Lp83DGn5asDh_Mnm1iW6cSlJbWKdqylU7VgkxCs4xCascFGCulsXhHtieaLHxvwj2JKiMNH8YDJsD-NDFO3OqjidVp0JsDW-0IOoNSo0qkBj_IwgHjI_g3hjv1btEsgty47tE-3PrzLi8Yu1SPrH6bsMH4ppnLYuPU4oLVmtv4ynn_y-gSWrWJBiefLc0-B5-30qWOxVW40)
```
@startuml
actor User

package "GD SDK" {
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

