export type ResumeIcon = 'briefcase' | 'github' | 'mail' | 'monitor' | 'phone';

export interface ContactItem {
  icon: ResumeIcon;
  text: string;
}
