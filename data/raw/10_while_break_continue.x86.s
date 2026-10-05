.intel_syntax noprefix
.globl main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 32
    mov DWORD PTR -4[rbp], 0
.BB0:
    mov DWORD PTR -8[rbp], 3
    jmp .WHTHEN2
.WHTHEN2:
    jmp .BB4
.WHELSE3:
    mov eax, DWORD PTR -8[rbp]
    mov DWORD PTR -4[rbp], eax
    jmp .main_ret
.BB4:
    mov DWORD PTR -20[rbp], 1
    mov eax, DWORD PTR -8[rbp]
    sub eax, DWORD PTR -20[rbp]
    mov DWORD PTR -24[rbp], eax
    mov eax, DWORD PTR -24[rbp]
    mov DWORD PTR -8[rbp], eax
    cmp DWORD PTR -8[rbp], 0
    je .IFFOLLOW8
    jmp .BB9
.IFFOLLOW8:
    jmp .BB4
.BB9:
    jmp .WHELSE3
.main_ret:
    mov eax, DWORD PTR -4[rbp]
    mov rsp, rbp
    pop rbp
    ret
