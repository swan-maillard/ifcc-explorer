// A title and one note per test program. Each note describes what's in that program's real IR.

export const meta: Record<string, { title: string; note: string }> = {
  "01_switch_break": {
    title: "switch with break",
    note: "The switch is the end of .BB0: compare a with each case value and jump to that case's block. Each break is a plain jump to .BB1, the code after the switch.",
  },
  "02_switch_no_break": {
    title: "switch that falls through",
    note: "There's no break, so the block for case 0 (.BB2) ends with a jump into the block for case 1 (.BB3). That's fall-through, and the result is 20.",
  },
  "07_switch_several_match": {
    title: "several cases, one body",
    note: "Cases 1, 2 and 3 share one body. Case 1 goes through an empty block (.BB4) first, cases 2 and 3 jump to .BB5 directly.",
  },
  "09_switch_expression": {
    title: "switch on an expression",
    note: "The compiler works out a*3 at compile time (#3 = 6). Every case ends with its own return, which is a jump to .main_ret.",
  },
  "06_while_continue": {
    title: "while with continue",
    note: "continue jumps straight back to the loop test in .WHCOND1, so b = b + 2 never makes it into the IR.",
  },
  "10_while_break_continue": {
    title: "break and continue inside an if",
    note: "while (1) needs no test: the constant is folded away and the body loops on itself through .IFFOLLOW8. The break is the jump from .BB9 to .WHELSE3, out of the loop.",
  },
  "08_while_if_return": {
    title: "return inside a loop",
    note: "When b isn't zero, .IFTHEN6 puts a in #return and jumps straight to .main_ret, out of the loop.",
  },
  "06_and_or": {
    title: "&& and || that skip work",
    note: "&& and || only look at their right side when they need to, so each one becomes several blocks. a == 1 is already known to be true, so .BB0 jumps straight to the b == 2 test in .AND3.",
  },
  "9_fact120": {
    title: "recursion, a loop and a switch",
    note: "Two functions, so two graphs. Each call to factorial gets its own stack frame: in run mode, step into the calls to watch n change.",
  },
};
