.intel_syntax noprefix
.globl factorial
factorial:
    push rbp
    mov rbp, rsp
    sub rsp, 48
    mov DWORD PTR -4[rbp], edi
.BB0:
    mov DWORD PTR -12[rbp], 1
    mov eax, DWORD PTR -4[rbp]
    cmp eax, DWORD PTR -12[rbp]
    setle al
    movzx   eax, al
    mov DWORD PTR -16[rbp], eax
    cmp DWORD PTR -16[rbp], 0
    je .IFELSE2
    jmp .IFTHEN1
.IFTHEN1:
    mov DWORD PTR -8[rbp], 1
    jmp .factorial_ret
.IFELSE2:
    mov DWORD PTR -24[rbp], 1
    mov eax, DWORD PTR -4[rbp]
    sub eax, DWORD PTR -24[rbp]
    mov DWORD PTR -28[rbp], eax
    mov edi, DWORD PTR -28[rbp]
    call factorial
    mov DWORD PTR -32[rbp], eax
    mov eax, DWORD PTR -4[rbp]
    imul eax, DWORD PTR -32[rbp]
    mov DWORD PTR -36[rbp], eax
    mov eax, DWORD PTR -36[rbp]
    mov DWORD PTR -8[rbp], eax
    jmp .factorial_ret
.factorial_ret:
    mov eax, DWORD PTR -8[rbp]
    mov rsp, rbp
    pop rbp
    ret
.globl main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 64
    mov DWORD PTR -4[rbp], 0
.BB4:
    mov DWORD PTR -8[rbp], 4
    mov edi, DWORD PTR -8[rbp]
    call factorial
    mov DWORD PTR -20[rbp], eax
    mov eax, DWORD PTR -20[rbp]
    mov DWORD PTR -16[rbp], eax
    jmp .WHCOND5
.WHCOND5:
    mov DWORD PTR -24[rbp], 2
    mov eax, DWORD PTR -16[rbp]
    cmp eax, DWORD PTR -24[rbp]
    setg al
    movzx   eax, al
    mov DWORD PTR -28[rbp], eax
    cmp DWORD PTR -28[rbp], 0
    je .AND10
    jmp .AND8
.WHELSE7:
    cmp DWORD PTR -16[rbp], 2
    je .BB17
    cmp DWORD PTR -16[rbp], 120
    je .BB17
    jmp .BB14
.AND8:
    mov DWORD PTR -36[rbp], 120
    mov eax, DWORD PTR -16[rbp]
    cmp eax, DWORD PTR -36[rbp]
    setl al
    movzx   eax, al
    mov DWORD PTR -40[rbp], eax
    cmp DWORD PTR -40[rbp], 0
    je .AND10
    jmp .AND9
.AND9:
    mov DWORD PTR -32[rbp], 1
    jmp .ANDFOLLOW11
.AND10:
    mov DWORD PTR -32[rbp], 0
    jmp .ANDFOLLOW11
.ANDFOLLOW11:
    cmp DWORD PTR -32[rbp], 0
    je .WHELSE7
    jmp .BB12
.BB12:
    inc DWORD PTR -8[rbp]
    mov edi, DWORD PTR -8[rbp]
    call factorial
    mov DWORD PTR -52[rbp], eax
    mov eax, DWORD PTR -52[rbp]
    mov DWORD PTR -16[rbp], eax
    jmp .WHCOND5
.BB14:
    mov DWORD PTR -44[rbp], 2
    mov eax, DWORD PTR -8[rbp]
    cdq
    idiv DWORD PTR -44[rbp]
    mov DWORD PTR -48[rbp], edx
    mov eax, DWORD PTR -48[rbp]
    mov DWORD PTR -16[rbp], eax
    jmp .BB15
.BB15:
    mov eax, DWORD PTR -16[rbp]
    mov DWORD PTR -4[rbp], eax
    jmp .main_ret
.BB17:
    mov eax, DWORD PTR -8[rbp]
    mov DWORD PTR -16[rbp], eax
    jmp .BB15
.main_ret:
    mov eax, DWORD PTR -4[rbp]
    mov rsp, rbp
    pop rbp
    ret
