.globl main
main:
    addi sp, sp, -96
    sd ra, 24(sp)
    sd s0, 16(sp)
    addi s0, sp, -96
    mv a5, zero
    sw a5, -4(s0)
.BB0:
    li a5, 1
    sw a5, -8(s0)
    li a5, 2
    sw a5, -16(s0)
    li a5, 3
    sw a5, -24(s0)
    j .AND3
.IFELSE2:
    lw a5, -8(s0)
    lw a6, -16(s0)
    sgt a5, a5, a6
    sw a5, -52(s0)
    lw a5, -52(s0)
    beq a5, zero, .OR11
    j .OR12
.AND3:
    li a5, 2
    sw a5, -44(s0)
    lw a5, -16(s0)
    lw a6, -44(s0)
    sub a5, a5, a6
    seqz a5, a5
    sw a5, -48(s0)
    lw a5, -48(s0)
    beq a5, zero, .AND5
    j .AND4
.AND4:
    li a5, 1
    sw a5, -40(s0)
    j .ANDFOLLOW6
.AND5:
    li a5, 0
    sw a5, -40(s0)
    j .ANDFOLLOW6
.ANDFOLLOW6:
    lw a5, -40(s0)
    beq a5, zero, .IFELSE2
    j .BB7
.BB7:
    li a5, 1000
    sw a5, -68(s0)
    lw a5, -24(s0)
    lw a6, -68(s0)
    addw a5, a5, a6
    sw a5, -72(s0)
    lw a5, -72(s0)
    sw a5, -24(s0)
    j .IFELSE2
.IFELSE10:
    lw a5, -24(s0)
    sw a5, -4(s0)
    j .main_ret
.OR11:
    li a5, 1
    sw a5, -60(s0)
    lw a5, -8(s0)
    lw a6, -60(s0)
    sub a5, a5, a6
    seqz a5, a5
    sw a5, -64(s0)
    lw a5, -64(s0)
    beq a5, zero, .OR13
    j .OR12
.OR12:
    li a5, 1
    sw a5, -56(s0)
    j .OR14
.OR13:
    li a5, 0
    sw a5, -56(s0)
    j .OR14
.OR14:
    lw a5, -56(s0)
    beq a5, zero, .IFELSE10
    j .BB15
.BB15:
    li a5, 1000
    sw a5, -68(s0)
    lw a5, -24(s0)
    lw a6, -68(s0)
    addw a5, a5, a6
    sw a5, -72(s0)
    lw a5, -72(s0)
    sw a5, -24(s0)
    j .IFELSE10
.main_ret:
    lw a0, -4(s0)
    ld ra, 24(sp)
    ld s0, 16(sp)
    addi sp, sp, 96
    jr ra
