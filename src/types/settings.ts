export type SettingType = "boolean" | "select" | "string" | "number";

export interface UserSetting {
  key: string;
  label: string;
  description: string;
  type: SettingType;
  options?: string[]; // only for select type
  value: unknown;
}
