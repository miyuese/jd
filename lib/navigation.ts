import {
  Brain,
  FileText,
  FolderKanban,
  History,
  Layers,
  LayoutDashboard,
  PenLine,
  ScanSearch,
  Settings2,
  Target,
  type LucideIcon
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const navItems: NavItem[] = [
  {
    href: "/workspace",
    label: "工作台",
    icon: LayoutDashboard,
    description: "求职计划管理"
  },
  {
    href: "/memory",
    label: "记忆库",
    icon: Brain,
    description: "个人记忆与能力画像"
  },
  {
    href: "/resume-materials",
    label: "简历材料",
    icon: FileText,
    description: "录入已有简历内容"
  },
  {
    href: "/project-materials",
    label: "项目经历",
    icon: FolderKanban,
    description: "录入项目原始素材"
  },
  {
    href: "/cards",
    label: "我的卡片",
    icon: Layers,
    description: "简历×经历的组合卡片库"
  },
  {
    href: "/jd-analysis",
    label: "JD 分析",
    icon: ScanSearch,
    description: "岗位匹配分析"
  },
  {
    href: "/resume-rewrite",
    label: "简历改写",
    icon: PenLine,
    description: "简历表达优化"
  },
  {
    href: "/interview-prep",
    label: "面试准备",
    icon: Target,
    description: "面试讲稿生成"
  },
  {
    href: "/history",
    label: "历史版本",
    icon: History,
    description: "版本管理与恢复"
  },
  {
    href: "/settings",
    label: "模型设置",
    icon: Settings2,
    description: "AI 模型配置切换"
  }
];

/** 侧边导航分组（编辑式分区） */
export const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: "Overview", items: [navItems[0]] },
  { label: "Materials", items: navItems.slice(1, 4) },
  { label: "Process", items: [navItems[4]] },
  { label: "Output", items: navItems.slice(5, 8) },
  { label: "System", items: navItems.slice(8, 10) }
];
