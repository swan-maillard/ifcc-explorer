.intel_syntax noprefix
.globl main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 32
    mov DWORD PTR -4[rbp], 0
.BB0:
    mov DWORD PTR -8[rbp], 2
    cmp DWORD PTR -8[rbp], 0
    je .BB2
    cmp DWORD PTR -8[rbp], 1
    je .BB4
    cmp DWORD PTR -8[rbp], 2
    je .BB5
    cmp DWORD PTR -8[rbp], 3
    je .BB5
    jmp .BB1
.BB1:
    mov eax, DWORD PTR -8[rbp]
    mov DWORD PTR -4[rbp], eax
    jmp .main_ret
.BB2:
    mov DWORD PTR -8[rbp], 10
    jmp .BB1
.BB4:
    jmp .BB5
.BB5:
    mov DWORD PTR -8[rbp], 20
    jmp .BB1
.main_ret:
    mov eax, DWORD PTR -4[rbp]
    mov rsp, rbp
    pop rbp
    ret
