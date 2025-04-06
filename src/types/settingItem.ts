export interface SettingItem {
  id: string;
  title: string;
  description: string;
  checked?: boolean;
  onChange?: (value: boolean) => void;
  renderControl?: (
    checked?: boolean,
    onChange?: (value: boolean) => void
  ) => React.ReactNode;
}