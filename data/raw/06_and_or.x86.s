.intel_syntax noprefix
.globl main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 80
    mov DWORD PTR -4[rbp], 0
.BB0:
    mov DWORD PTR -8[rbp], 1
    mov DWORD PTR -16[rbp], 2
    mov DWORD PTR -24[rbp], 3
    jmp .AND3
.IFELSE2:
    mov eax, DWORD PTR -8[rbp]
    cmp eax, DWORD PTR -16[rbp]
    setg al
    movzx   eax, al
    mov DWORD PTR -52[rbp], eax
    cmp DWORD PTR -52[rbp], 0
    je .OR11
    jmp .OR12
.AND3:
    mov DWORD PTR -44[rbp], 2
    mov eax, DWORD PTR -16[rbp]
    cmp eax, DWORD PTR -44[rbp]
    sete al
    movzx   eax, al
    mov DWORD PTR -48[rbp], eax
    cmp DWORD PTR -48[rbp], 0
    je .AND5
    jmp .AND4
.AND4:
    mov DWORD PTR -40[rbp], 1
    jmp .ANDFOLLOW6
.AND5:
    mov DWORD PTR -40[rbp], 0
    jmp .ANDFOLLOW6
.ANDFOLLOW6:
    cmp DWORD PTR -40[rbp], 0
    je .IFELSE2
    jmp .BB7
.BB7:
    mov DWORD PTR -68[rbp], 1000
    mov eax, DWORD PTR -24[rbp]
    add eax, DWORD PTR -68[rbp]
    mov DWORD PTR -72[rbp], eax
    mov eax, DWORD PTR -72[rbp]
    mov DWORD PTR -24[rbp], eax
    jmp .IFELSE2
.IFELSE10:
    mov eax, DWORD PTR -24[rbp]
    mov DWORD PTR -4[rbp], eax
    jmp .main_ret
.OR11:
    mov DWORD PTR -60[rbp], 1
    mov eax, DWORD PTR -8[rbp]
    cmp eax, DWORD PTR -60[rbp]
    sete al
    movzx   eax, al
    mov DWORD PTR -64[rbp], eax
    cmp DWORD PTR -64[rbp], 0
    je .OR13
    jmp .OR12
.OR12:
    mov DWORD PTR -56[rbp], 1
    jmp .OR14
.OR13:
    mov DWORD PTR -56[rbp], 0
    jmp .OR14
.OR14:
    cmp DWORD PTR -56[rbp], 0
    je .IFELSE10
    jmp .BB15
.BB15:
    mov DWORD PTR -68[rbp], 1000
    mov eax, DWORD PTR -24[rbp]
    add eax, DWORD PTR -68[rbp]
    mov DWORD PTR -72[rbp], eax
    mov eax, DWORD PTR -72[rbp]
    mov DWORD PTR -24[rbp], eax
    jmp .IFELSE10
.main_ret:
    mov eax, DWORD PTR -4[rbp]
    mov rsp, rbp
    pop rbp
    ret
