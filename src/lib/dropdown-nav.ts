export interface DropdownNavState {
  selected: number;
  total: number;
}

export function handleDropdownKeydown(
  e: React.KeyboardEvent,
  state: DropdownNavState,
  onSelect: (index: number) => void,
  onClose: () => void
): DropdownNavState {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      return { ...state, selected: Math.min(state.selected + 1, state.total - 1) };
    case "ArrowUp":
      e.preventDefault();
      return { ...state, selected: Math.max(state.selected - 1, 0) };
    case "Enter":
      e.preventDefault();
      if (state.selected >= 0 && state.selected < state.total) {
        onSelect(state.selected);
      }
      onClose();
      return state;
    case "Escape":
      e.preventDefault();
      onClose();
      return state;
    default:
      return state;
  }
}
