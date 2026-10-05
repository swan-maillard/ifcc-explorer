.intel_syntax noprefix
.globl main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 48
    mov DWORD PTR -4[rbp], 0
.BB0:
    mov DWORD PTR -8[rbp], 2
    mov DWORD PTR -20[rbp], 6
    cmp DWORD PTR -20[rbp], 8
    je .BB3
    cmp DWORD PTR -20[rbp], 2
    je .BB4
    cmp DWORD PTR -20[rbp], 7
    je .BB5
    cmp DWORD PTR -20[rbp], 6
    je .BB6
    jmp .BB1
.BB1:
    mov DWORD PTR -40[rbp], 1
    mov eax, DWORD PTR -8[rbp]
    add eax, DWORD PTR -40[rbp]
    mov DWORD PTR -44[rbp], eax
    mov eax, DWORD PTR -44[rbp]
    mov DWORD PTR -4[rbp], eax
    jmp .main_ret
.BB3:
    mov DWORD PTR -4[rbp], 8
    jmp .main_ret
.BB4:
    mov DWORD PTR -4[rbp], 2
    jmp .main_ret
.BB5:
    mov DWORD PTR -4[rbp], 7
    jmp .main_ret
.BB6:
    mov DWORD PTR -4[rbp], 20
    jmp .main_ret
.main_ret:
    mov eax, DWORD PTR -4[rbp]
    mov rsp, rbp
    pop rbp
    ret
