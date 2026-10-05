.intel_syntax noprefix
.globl main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 48
    mov DWORD PTR -4[rbp], 0
.BB0:
    mov DWORD PTR -8[rbp], 5
    mov DWORD PTR -16[rbp], -4
    jmp .WHCOND1
.WHCOND1:
    cmp DWORD PTR -8[rbp], 0
    je .WHELSE3
    jmp .BB4
.WHELSE3:
    mov eax, DWORD PTR -8[rbp]
    mov DWORD PTR -4[rbp], eax
    jmp .main_ret
.BB4:
    mov DWORD PTR -28[rbp], 1
    mov eax, DWORD PTR -8[rbp]
    sub eax, DWORD PTR -28[rbp]
    mov DWORD PTR -32[rbp], eax
    mov eax, DWORD PTR -32[rbp]
    mov DWORD PTR -8[rbp], eax
    mov eax, DWORD PTR -16[rbp]
    add eax, DWORD PTR -8[rbp]
    mov DWORD PTR -36[rbp], eax
    mov eax, DWORD PTR -36[rbp]
    mov DWORD PTR -16[rbp], eax
    cmp DWORD PTR -16[rbp], 0
    je .BB5
    jmp .IFTHEN6
.BB5:
    jmp .WHCOND1
.IFTHEN6:
    mov eax, DWORD PTR -8[rbp]
    mov DWORD PTR -4[rbp], eax
    jmp .main_ret
.main_ret:
    mov eax, DWORD PTR -4[rbp]
    mov rsp, rbp
    pop rbp
    ret
