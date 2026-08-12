const baseButton = "font-ui font-extrabold text-[0.9rem] uppercase tracking-[0.08em] h-[52px] px-6 cursor-pointer border-[3px] disabled:cursor-not-allowed";
export const variants = {
  card: "bg-paper border-[3px] border-ink p-6 max-[640px]:p-5",
  title: "flex items-center gap-[0.7rem] mb-5 pb-[0.9rem] border-b-[2px] border-dashed border-gray text-[0.85rem] font-extrabold uppercase tracking-[0.16em] [&>span:last-child:not(:first-child)]:ml-auto",
  icon: "grid place-items-center w-9 h-9 shrink-0 text-ink border-[2px] border-ink [&>svg]:w-5 [&>svg]:h-5 [&>svg]:stroke-[2.25]",
  badge: { base: "text-[0.72rem] font-extrabold uppercase tracking-[0.1em] px-[0.7rem] py-[0.35rem] whitespace-nowrap border-[2px]", on: "text-paper bg-ink border-ink", off: "text-ink bg-paper border-ink", online: "text-paper bg-ink border-ink", offline: "text-danger bg-paper border-danger border-dashed", hidden: "hidden" },
  button: { default: `${baseButton} border-ink bg-paper text-ink active:border-ink active:bg-ink active:text-paper disabled:border-gray disabled:bg-paper disabled:text-gray`, primary: `${baseButton} border-ink bg-action text-ink active:border-ink active:bg-paper active:text-ink disabled:border-gray disabled:bg-paper disabled:text-gray`, danger: `${baseButton} border-danger bg-danger text-paper active:border-danger active:bg-paper active:text-danger disabled:border-gray disabled:bg-paper disabled:text-gray`, relay: "font-ui font-extrabold text-[0.72rem] uppercase tracking-[0.08em] cursor-pointer border-[2px] border-ink bg-paper text-ink h-[38px] px-4 ml-auto" },
  controls: "flex flex-wrap gap-[0.9rem] mb-6 [&>button]:flex-1",
  phases: "flex gap-[6px] mb-6 min-h-24",
  phase: { base: "relative flex flex-col justify-center min-w-0 border-[2px] py-2 px-[0.8rem] max-[640px]:py-[0.4rem] max-[640px]:px-[0.6rem]", normal: "bg-paper text-ink border-ink", fertigation: "bg-ink text-paper border-ink", flush: "basis-[7rem] grow-0 shrink-0", label: "text-[0.66rem] font-extrabold tracking-[0.1em] uppercase overflow-hidden text-ellipsis whitespace-nowrap", value: "font-num font-extrabold text-[1.4rem] max-[640px]:text-[1.1rem] leading-[1.3] [&>small]:ml-1 [&>small]:font-ui [&>small]:text-[0.65rem] [&>small]:font-extrabold [&>small]:tracking-[0.06em]", slider: "absolute z-[1] -right-4 top-0 h-full w-8 cursor-ew-resize appearance-none bg-transparent accent-ink [writing-mode:vertical-lr] [direction:rtl]" },
  durations: { container: "grid gap-[0.8rem]", label: "flex items-center gap-2 text-[0.9rem] font-bold", input: "w-[5.2rem] h-[46px] ml-auto px-[0.6rem] font-num text-[1.05rem] font-extrabold text-ink text-center bg-paper border-[2px] border-ink" },
  metric: { list: "m-0", row: "flex items-baseline justify-between py-[0.6rem] border-b-[2px] border-dashed border-gray last:border-b-0", term: "text-[0.9rem] font-bold", definition: "m-0", value: "font-num font-extrabold text-[1.7rem] tabular-nums", unit: "not-italic text-[0.78rem] font-extrabold ml-[0.35rem]" },
  valve: { heading: "m-0 mb-[0.7rem] text-[0.72rem] font-extrabold uppercase tracking-[0.14em]", select: "grid grid-cols-3 gap-[6px] mb-2", button: "font-ui font-extrabold text-[0.7rem] uppercase tracking-[0.08em] cursor-pointer h-[46px] px-[0.4rem] border-[2px]", inactive: "bg-paper text-ink border-ink", active: "bg-ink text-paper border-ink", pending: "bg-paper text-ink border-ink border-dashed", status: "m-0 mb-6 min-h-[2.4em] text-[0.68rem] font-bold leading-[1.2] tracking-[0.06em] uppercase" },
  relay: { list: "list-none m-0 p-0", row: "flex items-center gap-[0.8rem] py-[0.6rem] text-[0.95rem] font-bold border-b-[2px] border-dashed border-gray last:border-b-0", dot: "w-4 h-4 shrink-0 border-[2px]", off: "bg-paper border-ink", on: "bg-ink border-ink" },
  events: { list: "list-none m-0 p-0 text-[0.9rem] max-h-60 overflow-y-auto empty:after:content-['Nothing_yet_—_events_appear_here_as_the_system_reports_them.'] empty:after:block empty:after:py-2 empty:after:italic", row: "py-[0.4rem] border-b-[2px] border-dashed", normal: "text-ink border-gray", time: "font-num tabular-nums font-extrabold mr-[0.8rem]", danger: "text-danger border-danger font-bold" },
  menu: { wrap: "relative ml-auto", trigger: "w-[42px] h-9 p-0 leading-none tracking-normal text-[1.1rem] border-[2px] border-ink bg-paper text-ink", panel: "absolute z-[2] right-0 top-[calc(100%+6px)] w-[250px] p-[0.7rem] border-[3px] border-ink bg-paper", item: "w-full h-11 px-[0.7rem] text-left border-[2px] border-ink bg-paper text-ink font-ui font-extrabold uppercase tracking-[0.08em]", reason: "min-h-[1.5em] m-[0.5rem_0_0] text-[0.72rem] font-extrabold uppercase tracking-[0.06em]" },
  schematic: {
    kicker: "text-[0.56rem] font-extrabold uppercase tracking-[0.1em]",
    box: "flex flex-col justify-center border-[2px] border-ink px-2 text-left cursor-pointer min-w-0",
    boxOn: "bg-ink text-paper",
    boxOff: "bg-paper text-ink",
    boxLabel: "text-[0.66rem] font-extrabold uppercase tracking-[0.08em] overflow-hidden text-ellipsis whitespace-nowrap",
    boxState: "font-num text-[0.8rem] font-extrabold",
    node: "flex flex-col items-center justify-center border-[2px] cursor-pointer",
    nodeValue: "font-num text-[1.15rem] font-extrabold leading-tight",
    nodeUnit: "text-[0.56rem] font-extrabold uppercase tracking-[0.06em]",
    nodeWarn: "text-[0.56rem] font-extrabold uppercase tracking-[0.06em] text-warning",
    // Inside the box, so marking the blocked pump never changes its size and
    // the square stays centred on the spine.
    nodeWarnDot: "absolute right-[3px] top-[3px] h-[6px] w-[6px] bg-warning",
    srOnly: "absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]",
    divider: "border-t-[2px] border-dashed border-gray min-[1100px]:border-t-0 min-[1100px]:border-l-[2px] min-[1100px]:h-full",
    // Small-screen stacked pipeline. Tap targets stay at least 48px tall.
    stackCell: "flex min-h-[52px] flex-col justify-center border-[2px] border-ink px-2 py-1 text-left cursor-pointer min-w-0",
    stackLabel: "text-[0.62rem] font-extrabold uppercase tracking-[0.06em] overflow-hidden text-ellipsis whitespace-nowrap",
    stackBand: "flex min-h-[52px] w-full items-center gap-2 border-[2px] px-3 py-2 text-left cursor-pointer",
    stackSelected: "outline outline-[2px] outline-offset-[2px] outline-ink",
    panel: "p-3 min-h-[190px]",
    panelTitle: "text-[0.56rem] font-extrabold uppercase tracking-[0.1em] block border-b-[2px] border-dashed border-gray pb-2",
    fieldLabel: "text-[0.62rem] font-extrabold uppercase tracking-[0.1em]",
    fieldInput: "h-[38px] w-full border-[2px] border-ink bg-paper px-2 font-ui text-[0.8rem] font-bold text-ink",
    warn: "mt-3 border-[2px] border-warning p-2",
    warnTitle: "block text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-warning",
    note: "m-0 text-[0.78rem] font-bold leading-snug",
    flowing: "pipe-flowing",
  },
  // Absolutely positioned so revealing it shifts no layout (DESIGN.md §3).
  hoverDialog: {
    base: "absolute z-[3] w-[184px] border-[2px] border-warning bg-paper p-2 text-left",
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    title: "block text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-warning",
    body: "m-0 mt-1 text-[0.7rem] font-bold leading-snug text-ink",
  },
  // The scrim is a structural layer, not a palette entry (DESIGN.md), and it
  // must stay translucent: an opaque backdrop turns the Confirmation into a
  // full-page takeover instead of an overlay.
  dialog: { backdrop: "m-auto max-w-[min(100%-2rem,480px)] p-0 border-0 bg-transparent text-ink backdrop:bg-ink/40", panel: "p-6 border-[3px] border-ink bg-paper", title: "m-0 mb-4 text-[0.85rem] font-extrabold uppercase tracking-[0.16em]", text: "m-0 font-bold", status: "min-h-[1.6em] mt-4 font-bold", danger: "text-danger", actions: "flex justify-end gap-[0.8rem] mt-5 [&>button]:h-[46px]" },
} as const;
