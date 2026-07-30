import { useState, useEffect, useRef, useMemo } from "react";
import { clsx } from "clsx";
import * as Accordion from "@radix-ui/react-accordion";
import {
  LayoutDashboard, Grid3X3, List, Table2, Calendar, GitBranch,
  Sun, Clock, Crosshair, BookOpen, Folder, Zap, Trophy,
  BarChart2, Settings, Plus, Search, X, ChevronRight,
  ChevronDown, ChevronLeft, Check, Pencil, Trash2,
  Lock, Inbox, FolderOpen, Swords,
} from "lucide-react";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid
} from "recharts";

// ─── PALETTE: dark dungeon / gold ─────────────────────────────
const C = {
  bg:      "#0d0f14",
  panel:   "#13161d",
  nested:  "#10131a",
  border:  "#1e2330",
  gold:    "#f0b429",
  goldDim: "#c48a0f",
  xpGold:  "#ffd93d",
  coin:    "#f4a300",
  teal:    "#4ecca3",
  flame:   "#ff6b35",
  text:    "#e2e0d8",
  muted:   "#6b7483",
  dim:     "#3a3f50",
  red:     "#e94560",
  violet:  "#a29bfe",
  cyan:    "#00b8d9",
  green:   "#52c41a",
  yellow:  "#f6c90e",
};

// ─── TYPES ────────────────────────────────────────────────────
type Screen = "dashboard"|"tasks"|"today"|"inbox-view"|"waiting"|"focus"|"projects"|"sprints"|"achievements"|"statistics"|"settings"|"character";
type TaskTab = "kanban"|"list"|"calendar"|"timeline"|"by-project"|"archive";
type Status = "inbox"|"todo"|"ready"|"in-progress"|"blocked"|"waiting-external"|"testing"|"done"|"archived";
type Priority = "p0"|"p1"|"p2"|"p3"|"p4";
type TaskType = "coding"|"investigation"|"study"|"analysis"|"documentation"|"bug"|"deployment"|"testing"|"meeting"|"research"|"design"|"maintenance"|"refactor"|"incident"|"communication";
type Effort = "xs"|"s"|"m"|"l"|"xl"|"xxl";
type Reporter = "self"|"qa"|"manager"|"pm"|"client"|"lecturer"|"friend"|"other";

interface Task {
  id: string; title: string; description: string;
  status: Status; priority: Priority; type: TaskType;
  effort: Effort; storyPoints: number;
  project: string; projectId: string; sprint: string|null;
  tags: string[]; dueDate: string|null;
  createdAt: string; completedAt: string|null;
  waitingOn: string|null; reporter: Reporter;
  parentId: string|null; attachments: string[]; deliverables: string[];
}
interface Project { id:string; name:string; color:string; emoji:string; category:string; description:string; totalTasks:number; completedTasks:number; status:"active"|"on-hold"|"completed"; }
interface Sprint { id:string; name:string; startDate:string; endDate:string; status:"active"|"completed"|"planning"; taskIds:string[]; goal:string; }
interface Achievement { id:string; name:string; description:string; icon:string; unlocked:boolean; unlockedAt:string|null; xp:number; category:"combat"|"exploration"|"crafting"|"social"; }

// ─── CONFIG ────────────────────────────────────────────────────
const PRIORITY_CFG: Record<Priority,{label:string;color:string;shape:string;xpBase:number;coin:number}> = {
  p0:{label:"P0 Critical",color:C.red,   shape:"■",xpBase:100,coin:5},
  p1:{label:"P1 High",    color:C.yellow,shape:"▲",xpBase:60, coin:3},
  p2:{label:"P2 Normal",  color:C.teal,  shape:"●",xpBase:30, coin:1},
  p3:{label:"P3 Low",     color:C.muted, shape:"○",xpBase:15, coin:0},
  p4:{label:"P4 Someday", color:C.dim,   shape:"·",xpBase:5,  coin:0},
};
const STATUS_CFG: Record<Status,{label:string;color:string;shape:string}> = {
  inbox:             {label:"Inbox",        color:C.muted, shape:"▣"},
  todo:              {label:"Todo",         color:C.muted, shape:"□"},
  ready:             {label:"Ready",        color:C.teal,  shape:"◈"},
  "in-progress":     {label:"In Progress",  color:C.yellow,shape:"▶"},
  blocked:           {label:"Blocked",      color:C.red,   shape:"✕"},
  "waiting-external":{label:"Waiting Ext.", color:C.violet,shape:"⏸"},
  testing:           {label:"Testing",      color:C.cyan,  shape:"◆"},
  done:              {label:"Done",         color:C.green, shape:"✓"},
  archived:          {label:"Archived",     color:C.dim,   shape:"◫"},
};
const TYPE_CFG: Record<TaskType,{label:string;emoji:string}> = {
  coding:{label:"Coding",emoji:"💻"},investigation:{label:"Investigation",emoji:"🔍"},
  study:{label:"Study",emoji:"📖"},analysis:{label:"Analysis",emoji:"📊"},
  documentation:{label:"Documentation",emoji:"📝"},bug:{label:"Bug",emoji:"🐞"},
  deployment:{label:"Deployment",emoji:"🚀"},testing:{label:"Testing",emoji:"🧪"},
  meeting:{label:"Meeting",emoji:"👥"},research:{label:"Research",emoji:"💡"},
  design:{label:"Design",emoji:"🎨"},maintenance:{label:"Maintenance",emoji:"⚙️"},
  refactor:{label:"Refactor",emoji:"📦"},incident:{label:"Incident",emoji:"🔥"},
  communication:{label:"Communication",emoji:"📞"},
};
const EFFORT_OPTS: Effort[] = ["xs","s","m","l","xl","xxl"];
const SP_OPTS = [0,1,2,3,5,8,13,21];
const REPORTER_OPTS: Reporter[] = ["self","qa","manager","pm","client","lecturer","friend","other"];

// ─── GAMIFICATION ─────────────────────────────────────────────
function xpForLevel(n:number){return Math.round((100*Math.pow(n,1.5))/10)*10;}
function getLevelInfo(xp:number){
  let cum=0,lv=1;
  while(true){const need=xpForLevel(lv);if(cum+need>xp)return{level:lv,currentXP:xp-cum,nextLevelXP:need};cum+=need;lv++;}
}
function calcXP(p:Priority,sp:number,onTime:boolean){
  return Math.round((PRIORITY_CFG[p].xpBase+sp*10)*(onTime?1.2:1));
}
function calcCoins(p:Priority,sp:number){return sp+PRIORITY_CFG[p].coin;}
function streakViz(d:number){
  if(d>=30)return{icon:"🔥🔥",label:"Blaze"};
  if(d>=14)return{icon:"🏕️",label:"Bonfire"};
  if(d>=7) return{icon:"🔥",label:"Steady Fire"};
  if(d>=3) return{icon:"🕯️",label:"Small Flame"};
  return{icon:"✨",label:"Spark"};
}

// ─── MOCK DATA ─────────────────────────────────────────────────
const INITIAL_PROJECTS: Project[] = [
  {id:"p1",name:"ATS Platform",    color:C.red,   emoji:"🏢",category:"Full-time",  description:"Applicant Tracking System — squad lead",totalTasks:24,completedTasks:18,status:"active"},
  {id:"p2",name:"Thesis",          color:C.violet,emoji:"🎓",category:"University", description:"Distributed systems thesis — Q3 2026",   totalTasks:15,completedTasks:4, status:"active"},
  {id:"p3",name:"Atlas",           color:C.teal,  emoji:"🚀",category:"Side Project",description:"This app — personal second brain",       totalTasks:20,completedTasks:6, status:"active"},
  {id:"p4",name:"Freelance—Shire", color:C.yellow,emoji:"💼",category:"Freelance",  description:"E-commerce client: Shire & Sons Ltd.",   totalTasks:12,completedTasks:9, status:"active"},
  {id:"p5",name:"Personal",        color:C.muted, emoji:"🏠",category:"Personal",   description:"Health, finance, home maintenance",       totalTasks:8, completedTasks:5, status:"active"},
];
const INITIAL_TASKS: Task[] = [
  {id:"t1", title:"Fix auth bypass in session invalidation",        description:"Session tokens not invalidated on logout.",         status:"in-progress",      priority:"p0",type:"bug",          effort:"m", storyPoints:3,project:"ATS Platform",     projectId:"p1",sprint:"s1",tags:["security","auth"],   dueDate:"2026-07-28",createdAt:"2026-07-20",completedAt:null,        waitingOn:null,                   reporter:"qa",      parentId:null,attachments:[],deliverables:[]},
  {id:"t2", title:"Deploy API gateway with rate limiting",          description:"Rate limiting, key rotation, canary routing.",      status:"in-progress",      priority:"p1",type:"deployment",  effort:"l", storyPoints:5,project:"ATS Platform",     projectId:"p1",sprint:"s1",tags:["infra","api"],        dueDate:"2026-07-30",createdAt:"2026-07-18",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t3", title:"Thesis chapter 3 — consensus algorithms",       description:"Cover Raft, Paxos, and PBFT with analysis.",        status:"in-progress",      priority:"p1",type:"study",       effort:"xl",storyPoints:8,project:"Thesis",          projectId:"p2",sprint:"s1",tags:["writing","distributed"],dueDate:"2026-08-02",createdAt:"2026-07-15",completedAt:null,        waitingOn:null,                   reporter:"lecturer",parentId:null,attachments:[],deliverables:[]},
  {id:"t4", title:"Design review — candidate pipeline UI",          description:"Wireframes sent to Zara (design lead).",            status:"waiting-external", priority:"p1",type:"design",      effort:"s", storyPoints:2,project:"ATS Platform",     projectId:"p1",sprint:"s1",tags:["design","ui"],        dueDate:"2026-07-31",createdAt:"2026-07-22",completedAt:null,        waitingOn:"Zara (Design Lead)",   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t5", title:"Stripe live-mode approval",                      description:"Business verification docs submitted.",             status:"waiting-external", priority:"p0",type:"communication",effort:"xs",storyPoints:1,project:"Freelance—Shire",  projectId:"p4",sprint:null,tags:["payments","stripe"],  dueDate:"2026-08-10",createdAt:"2026-07-19",completedAt:null,        waitingOn:"Stripe Support",       reporter:"client",  parentId:null,attachments:[],deliverables:[]},
  {id:"t6", title:"Thesis supervisor sign-off on methodology",      description:"Chapter 2 needs approval.",                        status:"waiting-external", priority:"p1",type:"meeting",     effort:"xs",storyPoints:1,project:"Thesis",          projectId:"p2",sprint:"s1",tags:["thesis","supervisor"], dueDate:"2026-07-30",createdAt:"2026-07-21",completedAt:null,        waitingOn:"Dr. Miriam Voss",      reporter:"lecturer",parentId:null,attachments:[],deliverables:[]},
  {id:"t7", title:"Client feedback on Shire checkout prototype",    description:"Figma prototype shared. Awaiting go/no-go.",        status:"waiting-external", priority:"p1",type:"design",      effort:"s", storyPoints:2,project:"Freelance—Shire",  projectId:"p4",sprint:null,tags:["client","ux"],        dueDate:"2026-07-29",createdAt:"2026-07-23",completedAt:null,        waitingOn:"Shire & Sons Product", reporter:"client",  parentId:null,attachments:[],deliverables:[]},
  {id:"t8", title:"Migrate ATS DB to PostgreSQL 16",                description:"Blocked on DBA backup verification.",              status:"blocked",          priority:"p1",type:"maintenance", effort:"xl",storyPoints:8,project:"ATS Platform",     projectId:"p1",sprint:"s1",tags:["database","migration"], dueDate:"2026-08-05",createdAt:"2026-07-15",completedAt:null,        waitingOn:"DBA backup check",     reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t9", title:"E2E tests for Shire checkout flow",              description:"Playwright test suite — full checkout path.",       status:"testing",          priority:"p1",type:"testing",     effort:"m", storyPoints:3,project:"Freelance—Shire",  projectId:"p4",sprint:null,tags:["playwright","e2e"],   dueDate:"2026-07-30",createdAt:"2026-07-24",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t10",title:"Full-text search with Elasticsearch",            description:"Search across candidates, jobs, applications.",     status:"ready",            priority:"p1",type:"coding",      effort:"xl",storyPoints:8,project:"ATS Platform",     projectId:"p1",sprint:"s1",tags:["search","elasticsearch"],dueDate:"2026-08-08",createdAt:"2026-07-22",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t11",title:"GitHub Actions CI/CD pipeline",                  description:"Auto test on PR, staging on main, prod on tag.",   status:"ready",            priority:"p1",type:"deployment",  effort:"l", storyPoints:5,project:"Atlas",            projectId:"p3",sprint:null,tags:["devops","ci"],         dueDate:"2026-08-06",createdAt:"2026-07-20",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t12",title:"Optimize slow ATS reporting queries",            description:"5 queries >2s — missing indexes, N+1.",            status:"ready",            priority:"p1",type:"coding",      effort:"m", storyPoints:3,project:"ATS Platform",     projectId:"p1",sprint:"s1",tags:["performance","sql"],   dueDate:"2026-08-04",createdAt:"2026-07-25",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t13",title:"Unit tests for Atlas auth module",               description:"Coverage 48% → target 85%.",                       status:"todo",             priority:"p2",type:"testing",     effort:"m", storyPoints:3,project:"Atlas",            projectId:"p3",sprint:"s1",tags:["testing","auth"],      dueDate:"2026-08-10",createdAt:"2026-07-23",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t14",title:"Atlas onboarding flow",                          description:"Interactive tutorial for first-time users.",        status:"todo",             priority:"p2",type:"design",      effort:"l", storyPoints:5,project:"Atlas",            projectId:"p3",sprint:"s1",tags:["ux","onboarding"],     dueDate:"2026-08-14",createdAt:"2026-07-24",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t15",title:"Research distributed consensus for thesis",      description:"Survey latest Raft optimizations.",                 status:"todo",             priority:"p2",type:"research",    effort:"l", storyPoints:5,project:"Thesis",           projectId:"p2",sprint:"s1",tags:["research","raft"],     dueDate:"2026-08-12",createdAt:"2026-07-25",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t16",title:"Idea: finance tracker tab in Atlas",             description:"Quick brain dump — not triaged yet.",              status:"inbox",            priority:"p4",type:"research",    effort:"xs",storyPoints:0,project:"Atlas",            projectId:"p3",sprint:null,tags:["idea","finance"],     dueDate:null,        createdAt:"2026-07-26",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t17",title:"Buy ergonomic chair before Sept",                description:"Current chair causing back pain.",                  status:"inbox",            priority:"p3",type:"research",    effort:"xs",storyPoints:0,project:"Personal",         projectId:"p5",sprint:null,tags:["health","home"],      dueDate:null,        createdAt:"2026-07-27",completedAt:null,        waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t18",title:"JWT authentication (access + refresh tokens)",   description:"15-min access + 30-day refresh, httpOnly cookies.", status:"done",             priority:"p0",type:"coding",      effort:"l", storyPoints:5,project:"ATS Platform",     projectId:"p1",sprint:"s2",tags:["auth","security"],    dueDate:"2026-07-18",createdAt:"2026-07-12",completedAt:"2026-07-17",waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:["PR"]},
  {id:"t19",title:"Core database schema and Prisma migrations",     description:"Full ER model, constraints, indexes.",              status:"done",             priority:"p1",type:"coding",      effort:"l", storyPoints:5,project:"ATS Platform",     projectId:"p1",sprint:"s2",tags:["database","prisma"],  dueDate:"2026-07-16",createdAt:"2026-07-11",completedAt:"2026-07-16",waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:["PR"]},
  {id:"t20",title:"REST API documentation (OpenAPI 3.1)",           description:"Full spec + Swagger UI at /api/docs.",              status:"done",             priority:"p2",type:"documentation",effort:"m", storyPoints:3,project:"ATS Platform",     projectId:"p1",sprint:"s2",tags:["docs","api"],          dueDate:"2026-07-20",createdAt:"2026-07-15",completedAt:"2026-07-19",waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:["Confluence Page"]},
  {id:"t21",title:"Datadog APM + Sentry + PagerDuty",              description:"All production services covered.",                  status:"done",             priority:"p1",type:"maintenance", effort:"m", storyPoints:3,project:"ATS Platform",     projectId:"p1",sprint:"s2",tags:["monitoring","datadog"],dueDate:"2026-07-21",createdAt:"2026-07-16",completedAt:"2026-07-21",waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
  {id:"t22",title:"Shire product catalogue CSV import",             description:"Bulk import 3,000 products from legacy system.",   status:"done",             priority:"p1",type:"coding",      effort:"m", storyPoints:3,project:"Freelance—Shire",  projectId:"p4",sprint:"s2",tags:["import","csv"],        dueDate:"2026-07-19",createdAt:"2026-07-14",completedAt:"2026-07-19",waitingOn:null,                   reporter:"client",  parentId:null,attachments:[],deliverables:["PR"]},
  {id:"t23",title:"Monorepo setup with pnpm workspaces",            description:"Shared ESLint, TypeScript references.",             status:"done",             priority:"p2",type:"maintenance", effort:"s", storyPoints:2,project:"Atlas",            projectId:"p3",sprint:"s2",tags:["setup","monorepo"],    dueDate:"2026-07-14",createdAt:"2026-07-10",completedAt:"2026-07-13",waitingOn:null,                   reporter:"self",    parentId:null,attachments:[],deliverables:[]},
];
const SPRINTS: Sprint[] = [
  {id:"s1",name:"Sprint 7 — The Awakening",startDate:"2026-07-21",endDate:"2026-08-03",status:"active",   taskIds:["t1","t2","t3","t4","t6","t8","t10","t12","t13","t14","t15"],goal:"Ship API gateway, patch auth bug, deliver thesis Chapter 3."},
  {id:"s2",name:"Sprint 6 — Dark Passage",  startDate:"2026-07-07",endDate:"2026-07-20",status:"completed",taskIds:["t18","t19","t20","t21","t22","t23"],                           goal:"Auth, DB schema, monitoring, first client deliverables."},
  {id:"s3",name:"Sprint 8 — The Reckoning", startDate:"2026-08-04",endDate:"2026-08-17",status:"planning", taskIds:[],                                                              goal:"Elasticsearch, Atlas onboarding, thesis Chapter 4."},
];
const ACHIEVEMENTS: Achievement[] = [
  {id:"a1", name:"First Blood",  description:"Complete your first quest",                 icon:"⚔",unlocked:true, unlockedAt:"2026-07-10",xp:50, category:"combat"},
  {id:"a2", name:"Task Slayer",  description:"Complete 10 quests total",                  icon:"🗡",unlocked:true, unlockedAt:"2026-07-15",xp:100,category:"combat"},
  {id:"a3", name:"Speed Runner", description:"Complete 5 quests in a single day",         icon:"⚡",unlocked:true, unlockedAt:"2026-07-16",xp:200,category:"combat"},
  {id:"a4", name:"Night Owl",    description:"Complete a quest between 10 PM and 4 AM",   icon:"🦉",unlocked:true, unlockedAt:"2026-07-17",xp:75, category:"exploration"},
  {id:"a5", name:"Guild Master", description:"Complete an entire project",                icon:"🛡",unlocked:true, unlockedAt:"2026-07-20",xp:500,category:"social"},
  {id:"a6", name:"Morning Hero", description:"Complete a quest before 7 AM",              icon:"🌅",unlocked:true, unlockedAt:"2026-07-21",xp:75, category:"exploration"},
  {id:"a7", name:"Bug Hunter",   description:"Complete 50 quests of type Bug",            icon:"🐞",unlocked:false,unlockedAt:null,        xp:300,category:"combat"},
  {id:"a8", name:"Sprint Hero",  description:"Complete every quest in an active sprint",  icon:"🏆",unlocked:false,unlockedAt:null,        xp:400,category:"combat"},
  {id:"a9", name:"Code Warrior", description:"Complete 100 coding quests",                icon:"💻",unlocked:false,unlockedAt:null,        xp:500,category:"crafting"},
  {id:"a10",name:"Scholar",      description:"Complete 50 University project quests",     icon:"📚",unlocked:false,unlockedAt:null,        xp:300,category:"crafting"},
  {id:"a11",name:"Perfect Week", description:"7 consecutive days all tasks done",         icon:"🌟",unlocked:false,unlockedAt:null,        xp:700,category:"social"},
  {id:"a12",name:"100 Quests",   description:"Complete 100 quests total",                 icon:"💎",unlocked:false,unlockedAt:null,        xp:300,category:"combat"},
];
const MOCK_XP = 2340, MOCK_STREAK = 9, MOCK_COINS = 47;

// ─── GAMIFICATION EXTRAS ──────────────────────────────────────
interface GameNotif {
  id:string; type:"xp"|"levelup"|"achievement"|"perfectday"|"streak-milestone"|"daily-quest";
  title:string; sub?:string; icon:string; color:string;
}

const STREAK_MILESTONES=[{days:7,label:"Steady Fire 🔥",bonus:50},{days:14,label:"Bonfire 🏕️",bonus:100},{days:30,label:"Blaze 🔥🔥",bonus:250}];
function getStreakMilestone(streak:number){
  const next=STREAK_MILESTONES.find(m=>m.days>streak);
  if(!next)return{label:"Blaze 🔥🔥",daysLeft:0,next:null};
  return{label:next.label,daysLeft:next.days-streak,next};
}

const DAILY_QUEST_POOL=[
  {label:"Complete 3 quests today",          goal:3,  icon:"⚔",  xp:80,  coins:5,  check:(t:Task[])=>t.filter(x=>x.status==="done"&&x.completedAt===new Date().toISOString().slice(0,10)).length},
  {label:"Finish a P0 Critical quest",        goal:1,  icon:"🎯",  xp:120, coins:8,  check:(t:Task[])=>t.filter(x=>x.status==="done"&&x.priority==="p0"&&x.completedAt===new Date().toISOString().slice(0,10)).length},
  {label:"Complete 2 different project quests",goal:2, icon:"🗡",  xp:100, coins:6,  check:(t:Task[])=>new Set(t.filter(x=>x.status==="done"&&x.completedAt===new Date().toISOString().slice(0,10)).map(x=>x.projectId)).size},
  {label:"Conquer 5 quests today",            goal:5,  icon:"💫",  xp:150, coins:10, check:(t:Task[])=>t.filter(x=>x.status==="done"&&x.completedAt===new Date().toISOString().slice(0,10)).length},
  {label:"Clear a Blocked quest",             goal:1,  icon:"🔓",  xp:90,  coins:6,  check:(t:Task[])=>t.filter(x=>x.status==="done"&&x.completedAt===new Date().toISOString().slice(0,10)&&x.tags.length>0).length},
];
const TODAY_DAILY_QUEST=DAILY_QUEST_POOL[new Date().getDate()%DAILY_QUEST_POOL.length];

function getAchievementProgress(id:string,tasks:Task[]):{current:number;max:number}|null{
  const done=tasks.filter(t=>t.status==="done");
  switch(id){
    case"a7":return{current:done.filter(t=>t.type==="bug").length,max:50};
    case"a9":return{current:done.filter(t=>t.type==="coding").length,max:100};
    case"a10":return{current:done.filter(t=>t.projectId==="p2").length,max:50};
    case"a12":return{current:done.length,max:100};
    default:return null;
  }
}

const LEVEL_TITLES:Record<number,string>={1:"Initiate",2:"Apprentice",3:"Journeyman",4:"Adventurer",5:"Veteran",6:"Champion",7:"Hero",8:"Legend",9:"Mythic",10:"Transcendent"};
function getLevelTitle(lv:number){return LEVEL_TITLES[lv]||`Rank ${lv}`;}

// ─── HELPERS ──────────────────────────────────────────────────
const fmtDate=(d:string|null)=>d?new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—";
const isOverdue=(d:string|null)=>{if(!d)return false;const x=new Date(d);x.setHours(23,59,59);return x<new Date();};
const isDueToday=(d:string|null)=>!!d&&new Date(d).toDateString()===new Date().toDateString();

// ─── BASE COMPONENTS ──────────────────────────────────────────
function Pnl({children,className,gold}:{children:React.ReactNode;className?:string;gold?:boolean}){
  return(
    <div className={clsx("border-2",className)}
      style={{backgroundColor:C.panel,borderColor:gold?C.gold:C.gold}}>
      {children}
    </div>
  );
}

function Btn({onClick,children,className,v="primary",sz="md",disabled}:{
  onClick?:()=>void;children:React.ReactNode;className?:string;
  v?:"primary"|"secondary"|"ghost"|"danger";sz?:"sm"|"md"|"lg";disabled?:boolean;
}){
  const styles:{[k:string]:React.CSSProperties}={
    primary:  {backgroundColor:C.gold,  color:C.bg,   border:`2px solid ${C.gold}`,  boxShadow:`0 2px 0 ${C.goldDim}`},
    secondary:{backgroundColor:C.nested,color:C.text, border:`2px solid ${C.border}`,boxShadow:`0 2px 0 #08090c`},
    ghost:    {backgroundColor:"transparent",color:C.muted,border:"2px solid transparent"},
    danger:   {backgroundColor:C.red,   color:"#fff", border:`2px solid ${C.red}`,   boxShadow:`0 2px 0 #8b1a2e`},
  };
  const s={sm:"px-2 py-0.5 text-sm",md:"px-3 py-1.5 text-sm",lg:"px-4 py-2 text-base"}[sz];
  return(
    <button onClick={onClick} disabled={disabled} style={styles[v]}
      className={clsx("inline-flex items-center gap-1.5 cursor-pointer font-['VT323'] select-none",
        "active:shadow-none active:translate-y-[2px] hover:brightness-110 transition-all duration-75",
        s,disabled&&"opacity-40 cursor-not-allowed",className)}>
      {children}
    </button>
  );
}

function SBadge({status}:{status:Status}){
  const{label,color,shape}=STATUS_CFG[status];
  return<span className="inline-flex items-center gap-1 whitespace-nowrap text-sm" style={{color}}><span>{shape}</span>{label}</span>;
}
function PBadge({priority}:{priority:Priority}){
  const{label,color,shape}=PRIORITY_CFG[priority];
  return<span className="inline-flex items-center gap-1 whitespace-nowrap text-sm" style={{color}}><span>{shape}</span>{label}</span>;
}
function PPip({priority}:{priority:Priority}){
  const{color,shape}=PRIORITY_CFG[priority];
  return<span className="text-base leading-none" style={{color}}>{shape}</span>;
}
function PixBar({value,max,color=C.teal,blocks=16}:{value:number;max:number;color?:string;blocks?:number}){
  const filled=max>0?Math.round((value/max)*blocks):0;
  return(
    <div className="flex gap-[2px] items-center">
      {Array.from({length:blocks}).map((_,i)=>(
        <div key={i} className="h-2.5 w-2.5"
          style={{backgroundColor:i<filled?color:C.nested,border:`1px solid ${C.border}`}}/>
      ))}
      <span className="ml-2 text-sm" style={{color}}>{value}/{max}</span>
    </div>
  );
}
function TagPill({tag}:{tag:string}){
  return<span className="inline-block px-1.5 text-sm" style={{border:`1px solid ${C.border}`,color:C.muted,backgroundColor:C.nested}}>#{tag}</span>;
}
function Divider({title}:{title:string}){
  return(
    <div className="flex items-center gap-2 mt-5 mb-2">
      <span className="text-sm" style={{color:C.gold}}>▸</span>
      <span className="text-sm tracking-widest uppercase" style={{color:C.muted}}>{title}</span>
      <div className="flex-1 h-px" style={{backgroundColor:C.border}}/>
    </div>
  );
}
function Inp({className,...p}:React.InputHTMLAttributes<HTMLInputElement>){
  return<input {...p}
    className={clsx("w-full px-3 py-1.5 font-['VT323'] text-sm outline-none",className)}
    style={{backgroundColor:C.nested,border:`2px solid ${C.border}`,color:C.text}}
    onFocus={e=>{e.currentTarget.style.borderColor=C.gold;}}
    onBlur={e=>{e.currentTarget.style.borderColor=C.border;}}/>;
}
function Sel({className,children,style,...p}:React.SelectHTMLAttributes<HTMLSelectElement>){
  return<select {...p}
    className={clsx("w-full px-3 py-1.5 font-['VT323'] text-sm outline-none",className)}
    style={{backgroundColor:C.nested,border:`2px solid ${C.border}`,color:C.text,...style}}
    onFocus={e=>{e.currentTarget.style.borderColor=C.gold;}}
    onBlur={e=>{e.currentTarget.style.borderColor=C.border;}}>
    {children}
  </select>;
}
function Txt({className,...p}:React.TextareaHTMLAttributes<HTMLTextAreaElement>){
  return<textarea {...p}
    className={clsx("w-full px-3 py-1.5 font-['VT323'] text-sm outline-none resize-none",className)}
    style={{backgroundColor:C.nested,border:`2px solid ${C.border}`,color:C.text}}
    onFocus={e=>{e.currentTarget.style.borderColor=C.gold;}}
    onBlur={e=>{e.currentTarget.style.borderColor=C.border;}}/>;
}

// ─── XP/LEVEL STRIP ───────────────────────────────────────────
function XPStrip({xp,streak,coins,compact}:{xp:number;streak:number;coins:number;compact?:boolean}){
  const{level,currentXP,nextLevelXP}=getLevelInfo(xp);
  const{icon,label}=streakViz(streak);
  const segs=compact?10:20;
  const filled=Math.round((currentXP/nextLevelXP)*segs);
  return(
    <div style={{backgroundColor:C.nested,borderBottom:`1px solid ${C.border}`}} className="px-4 py-3">
      <div className="flex items-center gap-3 mb-1.5">
        <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:compact?"10px":"14px",color:C.xpGold}}>{level}</span>
        <div className="flex-1">
          <div className="flex gap-[2px]">
            {Array.from({length:segs}).map((_,i)=>(
              <div key={i} className="flex-1 h-2"
                style={{backgroundColor:i<filled?C.xpGold:C.border,boxShadow:i<filled?`0 0 3px ${C.xpGold}40`:"none"}}/>
            ))}
          </div>
          <div className="flex justify-between text-sm mt-0.5" style={{color:C.muted}}>
            <span style={{color:C.xpGold}}>{currentXP} XP</span>
            <span>{Math.round((currentXP/nextLevelXP)*100)}%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span style={{color:C.flame}} title={`${streak}d: ${label}`}>{icon} {streak}d</span>
        <span style={{color:C.coin}}>🪙 <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px"}}>{coins}</span></span>
        {!compact&&<span className="ml-auto px-1.5 py-0.5 text-sm" style={{border:`1px solid ${C.gold}`,color:C.gold}}>LVL {level}</span>}
      </div>
      {compact&&(()=>{const sm=getStreakMilestone(streak);return sm.next?(
        <div className="mt-2 pt-2" style={{borderTop:`1px solid ${C.border}`}}>
          <div className="flex justify-between text-sm mb-1" style={{color:C.dim}}>
            <span style={{color:C.muted}}>Next: {sm.label}</span>
            <span style={{color:C.flame}}>{sm.daysLeft}d</span>
          </div>
          <div className="flex gap-[2px]">
            {Array.from({length:sm.next.days}).map((_,i)=>(
              <div key={i} className="flex-1 h-1"
                style={{backgroundColor:i<streak?C.flame:C.border,boxShadow:i<streak?`0 0 2px ${C.flame}60`:"none"}}/>
            ))}
          </div>
        </div>
      ):null;})()}
    </div>
  );
}

// ─── GAME NOTIFICATION STACK ──────────────────────────────────
function GameNotifStack({notifs,onDismiss}:{notifs:GameNotif[];onDismiss:(id:string)=>void}){
  if(!notifs.length)return null;
  return(
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {notifs.map(n=>(
        <div key={n.id} onClick={()=>onDismiss(n.id)}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 cursor-pointer"
          style={{backgroundColor:C.panel,border:`2px solid ${n.color}`,
            boxShadow:`4px 4px 0 ${C.bg}, 0 0 16px ${n.color}40`,minWidth:"240px",
            animation:"slideInRight 0.18s ease-out forwards"}}>
          <span style={{fontSize:"22px",lineHeight:1}}>{n.icon}</span>
          <div className="flex-1 min-w-0">
            <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:n.color,letterSpacing:"0.05em"}}>{n.title}</div>
            {n.sub&&<div className="text-sm mt-1 truncate" style={{color:C.muted}}>{n.sub}</div>}
          </div>
          <span className="text-sm" style={{color:C.dim}}>✕</span>
        </div>
      ))}
    </div>
  );
}

// ─── DAILY QUEST CARD ─────────────────────────────────────────
function DailyQuestCard({tasks,onClaim,claimed}:{tasks:Task[];onClaim:()=>void;claimed:boolean}){
  const q=TODAY_DAILY_QUEST;
  const progress=Math.min(q.check(tasks),q.goal);
  const pct=progress/q.goal;
  const done=pct>=1;
  return(
    <div style={{backgroundColor:C.panel,border:`2px solid ${done?(claimed?C.dim:C.teal):C.border}`,
      boxShadow:done&&!claimed?`0 0 12px ${C.teal}30`:"none"}} className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm tracking-widest" style={{color:C.gold}}>◆ DAILY QUEST</span>
          {done&&!claimed&&<span className="text-sm px-1.5 animate-pulse" style={{backgroundColor:`${C.teal}20`,border:`1px solid ${C.teal}`,color:C.teal}}>COMPLETE</span>}
          {claimed&&<span className="text-sm px-1.5" style={{color:C.dim,border:`1px solid ${C.dim}`}}>CLAIMED</span>}
        </div>
        <div className="flex items-center gap-3 text-sm" style={{color:C.muted}}>
          <span style={{color:C.xpGold}}>⚡ +{q.xp} XP</span>
          <span style={{color:C.coin}}>🪙 +{q.coins}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span style={{fontSize:"24px"}}>{q.icon}</span>
        <span className="text-sm flex-1" style={{color:done?C.text:C.muted}}>{q.label}</span>
        <span className="text-sm font-bold" style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:done?C.teal:C.gold}}>
          {progress}/{q.goal}
        </span>
      </div>
      <div className="flex gap-[3px] mb-3">
        {Array.from({length:q.goal}).map((_,i)=>(
          <div key={i} className="flex-1 h-2.5"
            style={{backgroundColor:i<progress?C.teal:C.nested,border:`1px solid ${i<progress?C.teal:C.border}`,
              boxShadow:i<progress?`0 0 4px ${C.teal}60`:"none"}}/>
        ))}
      </div>
      {done&&!claimed&&(
        <button onClick={onClaim}
          className="w-full py-1.5 text-sm font-['VT323'] tracking-widest transition-all hover:brightness-110 active:scale-95"
          style={{backgroundColor:`${C.teal}20`,border:`2px solid ${C.teal}`,color:C.teal,
            boxShadow:`0 2px 0 #2a8a70`}}>
          ✓ CLAIM REWARD
        </button>
      )}
    </div>
  );
}

// ─── COMPANION ────────────────────────────────────────────────
type CompanionMood = "excited"|"happy"|"idle"|"sad";

const COMPANION_MSGS: Record<CompanionMood, string[]> = {
  excited: ["QUEST COMPLETE!! ⚡","We did it!! 🎉","YES YES YES!! ✨","More XP!!! 🏆"],
  happy:   ["Streak is strong! 🔥","You're on fire!","Let's keep going!","I believe in you ✨"],
  idle:    ["Ready when you are...","Waiting patiently...","Take your time~","Here if you need me"],
  sad:     ["Please do some quests 🥺","I miss our streak...","Come back soon...","Don't give up... 😢"],
};

function CompanionWidget({level,streak,excited}:{level:number;streak:number;excited:boolean}){
  const[tip,setTip]=useState(false);
  const[msgIdx]=useState(()=>Math.floor(Math.random()*4));
  const mood:CompanionMood=excited?"excited":streak>=7?"happy":streak>=3?"idle":"sad";
  const compLv=Math.max(1,Math.round(level*0.65));

  const mc={excited:C.xpGold,happy:C.teal,idle:C.gold,sad:C.violet}[mood];
  const anim={
    excited:"cmpBounceFast 0.35s ease-in-out infinite",
    happy:  "cmpBounce 0.8s ease-in-out infinite",
    idle:   "cmpBreathe 2.8s ease-in-out infinite",
    sad:    "cmpSad 3.5s ease-in-out infinite",
  }[mood];

  // pixel art dims
  const W=40, H=34;
  const px=(s:Partial<React.CSSProperties>):React.CSSProperties=>({position:"absolute",...s});

  // Mouth shape per mood
  const MouthHappy=()=>(
    <div style={px({bottom:7,left:"50%",transform:"translateX(-50%)",width:16,height:8,
      borderLeft:`3px solid ${C.bg}`,borderRight:`3px solid ${C.bg}`,borderBottom:`3px solid ${C.bg}`,
      borderBottomLeftRadius:8,borderBottomRightRadius:8})}/>
  );
  const MouthIdle=()=>(
    <div style={px({bottom:10,left:"50%",transform:"translateX(-50%)",width:12,height:3,backgroundColor:C.bg})}/>
  );
  const MouthSad=()=>(
    <div style={px({bottom:9,left:"50%",transform:"translateX(-50%)",width:14,height:7,
      borderLeft:`3px solid ${C.bg}`,borderRight:`3px solid ${C.bg}`,borderTop:`3px solid ${C.bg}`,
      borderTopLeftRadius:8,borderTopRightRadius:8})}/>
  );

  return(
    <div style={{position:"relative",borderTop:`1px solid ${C.border}`,padding:"10px 0 6px"}}
      onMouseEnter={()=>setTip(true)} onMouseLeave={()=>setTip(false)}>

      {/* tooltip */}
      {tip&&(
        <div style={{
          position:"absolute",bottom:"calc(100% + 4px)",left:8,right:8,zIndex:50,
          backgroundColor:C.panel,border:`2px solid ${mc}`,padding:"8px 10px",
          boxShadow:`0 0 12px ${mc}30`,
        }}>
          <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"7px",color:mc,marginBottom:4}}>
            PIP · LV.{compLv}
          </div>
          <div className="text-sm" style={{color:C.muted,lineHeight:1.4}}>
            {COMPANION_MSGS[mood][msgIdx]}
          </div>
          <div className="text-sm mt-1" style={{color:C.dim}}>
            {mood==="excited"?"🏆":mood==="happy"?"🔥":mood==="idle"?"💤":"😢"} {mood.toUpperCase()}
            {" · "}streak {streak}d
          </div>
        </div>
      )}

      {/* sprite wrapper */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0,cursor:"default"}}>
        <div style={{animation:anim,transformOrigin:"bottom center",display:"inline-block"}}>
          {/* body */}
          <div style={{position:"relative",width:W,height:H,backgroundColor:mc,
            border:`2px solid rgba(0,0,0,0.35)`,imageRendering:"pixelated"}}>

            {/* shine pixel */}
            <div style={px({top:3,left:3,width:6,height:6,backgroundColor:"rgba(255,255,255,0.28)"})}/>

            {/* left eye white */}
            <div style={px({top:9,left:7,width:9,height:9,backgroundColor:"#fff"})}>
              {/* left pupil */}
              <div style={{position:"absolute",
                bottom: mood==="sad"?0:"auto", top: mood==="sad"?"auto":0,
                right:0,width:4,height:4,backgroundColor:C.bg}}/>
            </div>
            {/* right eye white */}
            <div style={px({top:9,right:7,width:9,height:9,backgroundColor:"#fff"})}>
              <div style={{position:"absolute",
                bottom: mood==="sad"?0:"auto", top: mood==="sad"?"auto":0,
                left:0,width:4,height:4,backgroundColor:C.bg}}/>
            </div>

            {/* excited star pupils */}
            {mood==="excited"&&<>
              <div style={px({top:10,left:9,width:5,height:5,backgroundColor:C.xpGold,clipPath:"polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"})}/>
              <div style={px({top:10,right:9,width:5,height:5,backgroundColor:C.xpGold,clipPath:"polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"})}/>
            </>}

            {/* happy cheeks */}
            {(mood==="happy"||mood==="excited")&&<>
              <div style={px({bottom:8,left:3,width:6,height:4,backgroundColor:"rgba(255,120,120,0.45)"})}/>
              <div style={px({bottom:8,right:3,width:6,height:4,backgroundColor:"rgba(255,120,120,0.45)"})}/>
            </>}

            {/* mouth */}
            {(mood==="happy"||mood==="excited")?<MouthHappy/>:mood==="idle"?<MouthIdle/>:<MouthSad/>}
          </div>

          {/* feet */}
          <div style={{display:"flex",justifyContent:"space-around",marginTop:0}}>
            <div style={{width:12,height:6,backgroundColor:mc,border:"2px solid rgba(0,0,0,0.3)",borderTop:"none"}}/>
            <div style={{width:12,height:6,backgroundColor:mc,border:"2px solid rgba(0,0,0,0.3)",borderTop:"none"}}/>
          </div>
        </div>

        {/* name + level */}
        <div style={{marginTop:5,textAlign:"center"}}>
          <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"7px",color:mc}}>PIP</div>
          <div className="text-sm" style={{color:C.dim}}>companion lv.{compLv}</div>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────
const NAV_CORE=[{id:"dashboard" as Screen,label:"Command Center",icon:LayoutDashboard}];
const NAV_SMART=[
  {id:"today"      as Screen,label:"Today",       icon:Sun},
  {id:"inbox-view" as Screen,label:"Inbox",        icon:Inbox},
  {id:"waiting"    as Screen,label:"Waiting Ext.", icon:Clock},
  {id:"focus"      as Screen,label:"Focus",        icon:Crosshair},
];
const NAV_MANAGE=[
  {id:"projects"    as Screen,label:"Projects",    icon:Folder},
  {id:"sprints"     as Screen,label:"Sprints",     icon:Zap},
  {id:"character"   as Screen,label:"Character",   icon:Swords},
  {id:"achievements"as Screen,label:"Achievements",icon:Trophy},
  {id:"statistics"  as Screen,label:"Progress",    icon:BarChart2},
  {id:"settings"    as Screen,label:"Settings",    icon:Settings},
];

function Sidebar({active,onNavigate,tasks,onNewTask,onCmd,xp,streak,coins,companionExcited}:{
  active:Screen;onNavigate:(s:Screen)=>void;tasks:Task[];
  onNewTask:()=>void;onCmd:()=>void;xp:number;streak:number;coins:number;companionExcited:boolean;
}){
  const counts:Partial<Record<Screen,number>>={
    "inbox-view":tasks.filter(t=>t.status==="inbox").length,
    waiting:tasks.filter(t=>t.status==="waiting-external").length,
    focus:tasks.filter(t=>(t.priority==="p0"||t.priority==="p1")&&t.status==="ready").length,
    today:tasks.filter(t=>isDueToday(t.dueDate)&&t.status!=="done"&&t.status!=="archived").length,
  };
  const badgeCol:Partial<Record<Screen,string>>={
    "inbox-view":C.muted,waiting:C.violet,focus:C.yellow,today:C.gold
  };
  const NI=({id,label,icon:Icon}:{id:Screen;label:string;icon:React.ComponentType<{size?:number}>})=>{
    const on=active===id;const cnt=counts[id];
    return(
      <button onClick={()=>onNavigate(id)}
        className="w-full flex items-center gap-2 px-3 py-1 text-left text-sm font-['VT323'] transition-all"
        style={{backgroundColor:on?C.panel:"transparent",color:on?C.gold:C.muted,
          borderLeft:on?`2px solid ${C.gold}`:"2px solid transparent"}}>
        <Icon size={12}/><span className="flex-1">{label}</span>
        {cnt!==undefined&&cnt>0&&(
          <span className="text-sm px-1" style={{backgroundColor:C.nested,border:`1px solid ${C.border}`,color:badgeCol[id]||C.gold}}>{cnt}</span>
        )}
      </button>
    );
  };
  return(
    <aside className="w-52 flex-shrink-0 flex flex-col h-full overflow-y-auto"
      style={{backgroundColor:C.nested,borderRight:`2px solid ${C.border}`}}>
      <div className="px-4 py-4" style={{borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"12px",color:C.gold}}>⚔ ATLAS</div>
        <div className="text-sm mt-1" style={{color:C.muted}}>Your Second Brain</div>
      </div>
      <XPStrip xp={xp} streak={streak} coins={coins} compact/>
      <div className="px-3 py-2" style={{borderBottom:`1px solid ${C.border}`}}>
        <button onClick={onCmd}
          className="w-full flex items-center gap-2 px-2 py-1 text-sm font-['VT323'] transition-colors"
          style={{backgroundColor:C.panel,border:`1px solid ${C.border}`,color:C.muted}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.color=C.text;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>
          <Search size={10}/><span>Search... Ctrl+K</span>
        </button>
      </div>
      <nav className="flex-1 py-1 overflow-y-auto">
        <div className="px-3 py-1 text-sm tracking-widest font-['VT323']" style={{color:C.dim}}>── CORE ──</div>
        {NAV_CORE.map(i=><NI key={i.id} {...i}/>)}
        <button onClick={()=>onNavigate("tasks")}
          className="w-full flex items-center gap-2 px-3 py-1 text-left text-sm font-['VT323'] transition-all"
          style={{backgroundColor:active==="tasks"?C.panel:"transparent",color:active==="tasks"?C.gold:C.muted,
            borderLeft:active==="tasks"?`2px solid ${C.gold}`:"2px solid transparent"}}>
          <Grid3X3 size={12}/><span className="flex-1">Tasks</span>
        </button>
        <div className="px-3 py-1 mt-1 text-sm tracking-widest font-['VT323']" style={{color:C.dim}}>── SMART VIEWS ──</div>
        {NAV_SMART.map(i=><NI key={i.id} {...i}/>)}
        <div className="px-3 py-1 mt-1 text-sm tracking-widest font-['VT323']" style={{color:C.dim}}>── MANAGE ──</div>
        {NAV_MANAGE.map(i=><NI key={i.id} {...i}/>)}
      </nav>
      <CompanionWidget level={getLevelInfo(xp).level} streak={streak} excited={companionExcited}/>
      <div className="p-3">
        <Btn onClick={onNewTask} className="w-full justify-center"><Plus size={12}/> New Quest</Btn>
      </div>
    </aside>
  );
}

// ─── TASK CARD (kanban) ───────────────────────────────────────
function TaskCard({task,onClick}:{task:Task;onClick:()=>void}){
  const overdue=isOverdue(task.dueDate)&&task.status!=="done";
  return(
    <div onClick={onClick} className="p-3 cursor-pointer hover:brightness-110 transition-all"
      style={{backgroundColor:C.nested,border:`2px solid ${STATUS_CFG[task.status].color}`}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-base">{TYPE_CFG[task.type].emoji}</span>
        <PPip priority={task.priority}/>
      </div>
      <p className="text-sm leading-tight mb-2 line-clamp-2" style={{color:C.text}}>{task.title}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">{task.tags.slice(0,2).map(t=><TagPill key={t} tag={t}/>)}</div>
        {task.dueDate&&<span className="text-sm" style={{color:overdue?C.red:C.muted}}>{overdue&&"⚠ "}{fmtDate(task.dueDate)}</span>}
      </div>
      {task.storyPoints>0&&<div className="mt-1 text-sm" style={{color:C.muted}}>{task.storyPoints} SP · {task.effort.toUpperCase()}</div>}
      {task.status==="waiting-external"&&task.waitingOn&&<div className="mt-1 text-sm" style={{color:C.violet}}>⏸ {task.waitingOn}</div>}
      {task.status==="blocked"&&task.waitingOn&&<div className="mt-1 text-sm" style={{color:C.red}}>✕ {task.waitingOn}</div>}
    </div>
  );
}

// ─── TASK ROW (list/table) ────────────────────────────────────
function TaskRow({task,onClick}:{task:Task;onClick:()=>void}){
  const overdue=isOverdue(task.dueDate)&&task.status!=="done"&&task.status!=="archived";
  const today=isDueToday(task.dueDate);
  return(
    <div onClick={onClick} className="flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors"
      style={{borderBottom:`1px solid ${C.border}`}}
      onMouseEnter={e=>(e.currentTarget.style.backgroundColor=C.nested)}
      onMouseLeave={e=>(e.currentTarget.style.backgroundColor="transparent")}>
      <PBadge priority={task.priority}/>
      <SBadge status={task.status}/>
      <span className="flex-1 text-sm truncate" style={{color:C.text}}>{task.title}</span>
      <span className="text-sm mr-1">{TYPE_CFG[task.type].emoji}</span>
      <span className="hidden md:block text-sm truncate max-w-[100px]" style={{color:C.muted}}>{task.project}</span>
      <span className="text-sm whitespace-nowrap" style={{color:overdue?C.red:today?C.gold:C.muted}}>
        {overdue&&"⚠ "}{fmtDate(task.dueDate)}
      </span>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
function DashboardView({tasks,sprints,onTaskClick,onNavigate,xp,streak,coins,dailyQuestClaimed,onClaimDailyQuest}:{
  tasks:Task[];sprints:Sprint[];onTaskClick:(t:Task)=>void;onNavigate:(s:Screen)=>void;
  xp:number;streak:number;coins:number;dailyQuestClaimed:boolean;onClaimDailyQuest:()=>void;
}){
  const{level,currentXP,nextLevelXP}=getLevelInfo(xp);
  const{icon,label}=streakViz(streak);
  const active=sprints.find(s=>s.status==="active");
  const sTasks=active?tasks.filter(t=>active.taskIds.includes(t.id)):[];
  const sDone=sTasks.filter(t=>t.status==="done").length;
  const stats=[
    {label:"DUE TODAY",   val:tasks.filter(t=>isDueToday(t.dueDate)&&t.status!=="done"&&t.status!=="archived").length,color:C.gold,  shape:"◆",nav:"today"   as Screen},
    {label:"OVERDUE",     val:tasks.filter(t=>isOverdue(t.dueDate)&&t.status!=="done"&&t.status!=="archived").length,  color:C.red,   shape:"▲",nav:"tasks"   as Screen},
    {label:"BLOCKED",     val:tasks.filter(t=>t.status==="blocked").length,                                              color:C.red,   shape:"✕",nav:"tasks"   as Screen},
    {label:"WAITING EXT.",val:tasks.filter(t=>t.status==="waiting-external").length,                                     color:C.violet,shape:"⏸",nav:"waiting" as Screen},
  ];
  const todayQ=tasks.filter(t=>(isDueToday(t.dueDate)||t.status==="in-progress")&&t.status!=="done"&&t.status!=="archived").slice(0,6);
  const recentW=tasks.filter(t=>t.status==="done").slice(-3).reverse();
  return(
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Hero gamification panel */}
      <div style={{backgroundColor:C.panel,border:`2px solid ${C.gold}`}} className="p-5">
        <div className="flex items-stretch gap-5 flex-wrap">
          {/* Level badge */}
          <div className="flex flex-col items-center justify-center px-5" style={{borderRight:`2px solid ${C.border}`}}>
            <div className="text-sm tracking-widest mb-1" style={{color:C.muted}}>LEVEL</div>
            <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"40px",color:C.xpGold,textShadow:`0 0 20px ${C.xpGold}50`}}>{level}</div>
            <div className="text-sm mt-1 px-2 py-0.5" style={{border:`1px solid ${C.gold}`,color:C.gold}}>ADVENTURER</div>
          </div>
          {/* XP bar */}
          <div className="flex-1 min-w-[180px] flex flex-col justify-center">
            <div className="flex justify-between text-sm mb-2" style={{color:C.muted}}>
              <span>XP Progress</span>
              <span style={{color:C.xpGold}}>{currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()}</span>
            </div>
            <div className="flex gap-[2px] h-4 mb-1">
              {Array.from({length:24}).map((_,i)=>{
                const on=i<Math.round((currentXP/nextLevelXP)*24);
                return<div key={i} className="flex-1" style={{backgroundColor:on?C.xpGold:C.border,boxShadow:on?`0 0 5px ${C.xpGold}50`:"none"}}/>;
              })}
            </div>
            <div className="text-sm" style={{color:C.muted}}>{Math.round((currentXP/nextLevelXP)*100)}% · {(nextLevelXP-currentXP).toLocaleString()} XP to Lv.{level+1}</div>
          </div>
          {/* Streak */}
          <div className="flex flex-col items-center justify-center px-4" style={{borderLeft:`2px solid ${C.border}`}}>
            <div className="text-2xl mb-0.5">{icon}</div>
            <div className="text-sm" style={{color:C.flame}}>{streak} days</div>
            <div className="text-sm" style={{color:C.muted}}>{label}</div>
          </div>
          {/* Coins */}
          <div className="flex flex-col items-center justify-center px-4" style={{borderLeft:`2px solid ${C.border}`}}>
            <div className="text-xl mb-0.5">🪙</div>
            <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"13px",color:C.coin}}>{coins}</div>
            <div className="text-sm mt-0.5" style={{color:C.muted}}>coins</div>
          </div>
        </div>
      </div>

      {/* 4 stat panels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s=>(
          <button key={s.label} onClick={()=>onNavigate(s.nav)}
            className="p-4 text-left transition-all hover:brightness-110"
            style={{backgroundColor:C.panel,border:`2px solid ${C.border}`}}
            onMouseEnter={e=>(e.currentTarget.style.borderColor=s.color)}
            onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
            <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"24px",color:s.color,textShadow:s.val>0?`0 0 8px ${s.color}40`:"none"}}>
              {s.shape} {s.val}
            </div>
            <div className="text-sm tracking-widest mt-2" style={{color:C.muted}}>{s.label}</div>
          </button>
        ))}
      </div>

      <DailyQuestCard tasks={tasks} onClaim={onClaimDailyQuest} claimed={dailyQuestClaimed}/>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Today's quests */}
        <Pnl className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm tracking-widest" style={{color:C.gold}}>◆ TODAY'S QUESTS</span>
            <Btn v="ghost" sz="sm" onClick={()=>onNavigate("today")}>All <ChevronRight size={10}/></Btn>
          </div>
          {todayQ.length===0?<p className="text-sm py-6 text-center" style={{color:C.muted}}>[ ALL CLEAR ]</p>:
            todayQ.map(t=>(
              <div key={t.id} onClick={()=>onTaskClick(t)}
                className="flex items-center gap-2 py-1.5 px-1 cursor-pointer"
                style={{borderBottom:`1px solid ${C.border}`}}
                onMouseEnter={e=>(e.currentTarget.style.backgroundColor=C.nested)}
                onMouseLeave={e=>(e.currentTarget.style.backgroundColor="transparent")}>
                <PPip priority={t.priority}/><SBadge status={t.status}/>
                <span className="flex-1 text-sm truncate" style={{color:C.text}}>{t.title}</span>
              </div>
            ))
          }
        </Pnl>
        {/* Waiting external */}
        <Pnl className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm tracking-widest" style={{color:C.violet}}>⏸ WAITING EXTERNAL</span>
            <Btn v="ghost" sz="sm" onClick={()=>onNavigate("waiting")}>All <ChevronRight size={10}/></Btn>
          </div>
          {tasks.filter(t=>t.status==="waiting-external").length===0?<p className="text-sm py-6 text-center" style={{color:C.muted}}>[ NONE ]</p>:
            tasks.filter(t=>t.status==="waiting-external").slice(0,5).map(t=>(
              <div key={t.id} onClick={()=>onTaskClick(t)}
                className="flex items-center gap-2 py-1.5 px-1 cursor-pointer"
                style={{borderBottom:`1px solid ${C.border}`}}
                onMouseEnter={e=>(e.currentTarget.style.backgroundColor=C.nested)}
                onMouseLeave={e=>(e.currentTarget.style.backgroundColor="transparent")}>
                <PPip priority={t.priority}/>
                <span className="flex-1 text-sm truncate" style={{color:C.text}}>{t.title}</span>
                <span className="text-sm truncate max-w-[80px]" style={{color:C.violet}}>{t.waitingOn}</span>
              </div>
            ))
          }
        </Pnl>
      </div>

      {/* Sprint bar */}
      {active&&(
        <div style={{backgroundColor:C.panel,border:`2px solid ${C.gold}`}} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm tracking-widest mb-1" style={{color:C.muted}}>▸ ACTIVE SPRINT</div>
              <div className="text-base" style={{color:C.xpGold}}>{active.name}</div>
            </div>
            <Btn v="secondary" sz="sm" onClick={()=>onNavigate("sprints")}>Details <ChevronRight size={10}/></Btn>
          </div>
          <p className="text-sm italic mb-3" style={{color:C.muted}}>"{active.goal}"</p>
          <PixBar value={sDone} max={Math.max(sTasks.length,1)} color={C.teal} blocks={20}/>
          <div className="flex gap-5 mt-2 text-sm" style={{color:C.muted}}>
            <span>{fmtDate(active.startDate)} → {fmtDate(active.endDate)}</span>
            <span style={{color:C.teal}}>{sTasks.length-sDone} remaining</span>
          </div>
        </div>
      )}

      {/* Recent wins */}
      {recentW.length>0&&(
        <div style={{backgroundColor:C.panel,border:`2px solid ${C.border}`}} className="p-4">
          <div className="text-sm tracking-widest mb-3" style={{color:C.teal}}>✓ RECENT WINS</div>
          {recentW.map(t=>{
            const xpEarned=calcXP(t.priority,t.storyPoints,!isOverdue(t.completedAt));
            return(
              <div key={t.id} className="flex items-center gap-3 py-1.5" style={{borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.green}}>✓</span>
                <span className="text-sm">{TYPE_CFG[t.type].emoji}</span>
                <span className="flex-1 text-sm truncate line-through" style={{color:C.muted}}>{t.title}</span>
                <span className="text-sm font-bold" style={{color:C.xpGold}}>+{xpEarned} XP</span>
                <span className="text-sm" style={{color:C.coin}}>+{calcCoins(t.priority,t.storyPoints)}🪙</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── KANBAN ───────────────────────────────────────────────────
function KanbanView({tasks,onTaskClick,onNewTask,noHeader}:{tasks:Task[];onTaskClick:(t:Task)=>void;onNewTask:()=>void;noHeader?:boolean}){
  const cols:Status[]=["inbox","todo","ready","in-progress","blocked","waiting-external","testing","done"];
  return(
    <div className="flex flex-col h-full">
      {!noHeader&&<div className="px-6 py-3 flex items-center justify-between" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>⊞ KANBAN BOARD</h1>
        <Btn onClick={onNewTask} sz="sm"><Plus size={12}/> New Quest</Btn>
      </div>}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 p-4 h-full min-w-max">
          {cols.map(status=>{
            const col=tasks.filter(t=>t.status===status);
            const{label,color}=STATUS_CFG[status];
            return(
              <div key={status} className="flex flex-col w-60 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3 pb-2" style={{borderBottom:`2px solid ${color}`}}>
                  <span style={{color}}>{STATUS_CFG[status].shape}</span>
                  <span className="text-sm tracking-widest font-['VT323']" style={{color}}>{label.toUpperCase()}</span>
                  <span className="text-sm" style={{color:C.muted}}>({col.length})</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {col.map(t=><TaskCard key={t.id} task={t} onClick={()=>onTaskClick(t)}/>)}
                  {col.length===0&&<div className="text-sm text-center py-8" style={{color:C.dim,border:`2px dashed ${C.border}`}}>[ EMPTY ]</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── LIST ─────────────────────────────────────────────────────
function ListView({tasks,onTaskClick,onNewTask,noHeader}:{tasks:Task[];onTaskClick:(t:Task)=>void;onNewTask:()=>void;noHeader?:boolean}){
  const[filterStatus,setFilterStatus]=useState<Status|"all">("all");
  const[sort,setSort]=useState<"priority"|"due"|"status">("priority");
  const filtered=useMemo(()=>{
    const pOrd:Priority[]=["p0","p1","p2","p3","p4"];
    let t=filterStatus==="all"?tasks.filter(t=>t.status!=="archived"):tasks.filter(t=>t.status===filterStatus);
    if(sort==="priority")return[...t].sort((a,b)=>pOrd.indexOf(a.priority)-pOrd.indexOf(b.priority));
    if(sort==="due")return[...t].sort((a,b)=>(a.dueDate||"z").localeCompare(b.dueDate||"z"));
    return[...t].sort((a,b)=>a.status.localeCompare(b.status));
  },[tasks,filterStatus,sort]);
  const statuses:Array<Status|"all">=["all","inbox","todo","ready","in-progress","blocked","waiting-external","testing","done"];
  return(
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        {!noHeader&&<h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>≡ LIST</h1>}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {statuses.map(s=>(
              <button key={s} onClick={()=>setFilterStatus(s)}
                className="px-2 py-0 text-sm font-['VT323'] transition-colors"
                style={{border:`1px solid ${filterStatus===s?C.gold:C.border}`,backgroundColor:filterStatus===s?C.panel:"transparent",color:filterStatus===s?C.gold:C.muted}}>
                {s==="all"?"ALL":`${STATUS_CFG[s].shape} ${STATUS_CFG[s].label.toUpperCase()}`}
              </button>
            ))}
          </div>
          <Sel value={sort} onChange={e=>setSort(e.target.value as typeof sort)} style={{width:"auto",padding:"0 8px"}}>
            <option value="priority">Priority</option>
            <option value="due">Due</option>
            <option value="status">Status</option>
          </Sel>
          {!noHeader&&<Btn onClick={onNewTask} sz="sm"><Plus size={12}/> New</Btn>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map(t=><TaskRow key={t.id} task={t} onClick={()=>onTaskClick(t)}/>)}
        {filtered.length===0&&<div className="text-center text-base py-20" style={{color:C.muted}}>[ NO QUESTS ]</div>}
      </div>
    </div>
  );
}

// ─── TABLE ────────────────────────────────────────────────────
function TableView({tasks,onTaskClick,noHeader}:{tasks:Task[];onTaskClick:(t:Task)=>void;noHeader?:boolean}){
  const[sc,setSc]=useState("priority");const[sd,setSd]=useState<"asc"|"desc">("asc");
  const pOrd:Priority[]=["p0","p1","p2","p3","p4"];
  const rows=useMemo(()=>[...tasks.filter(t=>t.status!=="archived")].sort((a,b)=>{
    let av:string|number="",bv:string|number="";
    if(sc==="priority"){av=pOrd.indexOf(a.priority);bv=pOrd.indexOf(b.priority);}
    else if(sc==="title"){av=a.title.toLowerCase();bv=b.title.toLowerCase();}
    else if(sc==="status"){av=a.status;bv=b.status;}
    else if(sc==="due"){av=a.dueDate||"z";bv=b.dueDate||"z";}
    else if(sc==="sp"){av=a.storyPoints;bv=b.storyPoints;}
    return sd==="asc"?(av<bv?-1:av>bv?1:0):(av>bv?-1:av<bv?1:0);
  }),[tasks,sc,sd]);
  const Col=({col,ch}:{col:string;ch:string})=>(
    <th onClick={()=>{setSd(sc===col&&sd==="asc"?"desc":"asc");setSc(col);}}
      className="px-3 py-2 text-left text-sm tracking-widest cursor-pointer whitespace-nowrap select-none"
      style={{color:sc===col?C.gold:C.muted}}>
      {ch}{sc===col?(sd==="asc"?" ▲":" ▼"):""}
    </th>
  );
  return(
    <div className="flex flex-col h-full">
      {!noHeader&&<div className="px-6 py-3" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>⊟ TABLE</h1>
      </div>}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0" style={{backgroundColor:C.bg,borderBottom:`2px solid ${C.border}`}}>
            <tr><Col col="priority" ch="PRIORITY"/><Col col="status" ch="STATUS"/>
              <th className="px-3 py-2 text-left text-sm" style={{color:C.muted}}>TYPE</th>
              <Col col="title" ch="TITLE"/><Col col="due" ch="DUE"/>
              <Col col="sp" ch="SP"/>
              <th className="px-3 py-2 text-left text-sm" style={{color:C.muted}}>EFFORT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t,i)=>{
              const ov=isOverdue(t.dueDate)&&t.status!=="done";
              return(
                <tr key={t.id} onClick={()=>onTaskClick(t)} className="cursor-pointer transition-colors"
                  style={{borderBottom:`1px solid ${C.border}`,backgroundColor:i%2===0?"transparent":`${C.nested}50`}}
                  onMouseEnter={e=>(e.currentTarget.style.backgroundColor=C.nested)}
                  onMouseLeave={e=>(e.currentTarget.style.backgroundColor=i%2===0?"transparent":`${C.nested}50`)}>
                  <td className="px-3 py-2"><PBadge priority={t.priority}/></td>
                  <td className="px-3 py-2"><SBadge status={t.status}/></td>
                  <td className="px-3 py-2 text-sm">{TYPE_CFG[t.type].emoji}</td>
                  <td className="px-3 py-2 text-sm max-w-xs truncate" style={{color:C.text}}>{t.title}</td>
                  <td className="px-3 py-2 text-sm" style={{color:ov?C.red:C.muted}}>{fmtDate(t.dueDate)}</td>
                  <td className="px-3 py-2 text-sm" style={{color:C.muted}}>{t.storyPoints}</td>
                  <td className="px-3 py-2 text-sm uppercase" style={{color:C.muted}}>{t.effort}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CALENDAR ─────────────────────────────────────────────────
function CalendarView({tasks,onTaskClick}:{tasks:Task[];onTaskClick:(t:Task)=>void}){
  const[vd,setVd]=useState(new Date(2026,6,1));
  const y=vd.getFullYear(),m=vd.getMonth();
  const first=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate();
  const byDate=useMemo(()=>{const mp:Record<string,Task[]>={};tasks.forEach(t=>{if(t.dueDate){if(!mp[t.dueDate])mp[t.dueDate]=[];mp[t.dueDate].push(t);}});return mp;},[tasks]);
  return(
    <div className="flex flex-col h-full">
      <div className="px-6 py-2 flex items-center gap-4" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <div className="flex items-center gap-2 ml-auto">
          <Btn v="secondary" sz="sm" onClick={()=>setVd(new Date(y,m-1,1))}><ChevronLeft size={11}/></Btn>
          <span className="text-sm min-w-[150px] text-center" style={{color:C.text}}>{vd.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
          <Btn v="secondary" sz="sm" onClick={()=>setVd(new Date(y,m+1,1))}><ChevronRight size={11}/></Btn>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["SUN","MON","TUE","WED","THU","FRI","SAT"].map(d=><div key={d} className="text-center text-sm tracking-widest py-1" style={{color:C.muted}}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({length:first}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:dim}).map((_,i)=>{
            const day=i+1;
            const ds=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const dt=byDate[ds]||[];
            const isToday=ds===new Date().toISOString().slice(0,10);
            return(
              <div key={day} className="min-h-[68px] p-1.5" style={{border:`1px solid ${isToday?C.gold:C.border}`,backgroundColor:C.panel}}>
                <div className="text-sm mb-1" style={{color:isToday?C.gold:C.muted}}>{day}</div>
                {dt.slice(0,2).map(t=>(
                  <div key={t.id} onClick={()=>onTaskClick(t)} className="text-sm px-1 mb-0.5 cursor-pointer truncate"
                    style={{color:PRIORITY_CFG[t.priority].color,borderLeft:`2px solid ${PRIORITY_CFG[t.priority].color}`}}>
                    {TYPE_CFG[t.type].emoji} {t.title}
                  </div>
                ))}
                {dt.length>2&&<div className="text-sm" style={{color:C.muted}}>+{dt.length-2}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────
function TimelineView({tasks,onTaskClick,projects}:{tasks:Task[];onTaskClick:(t:Task)=>void;projects:Project[]}){
  const start=new Date(2026,6,21),total=28;
  const active=tasks.filter(t=>!["archived","done"].includes(t.status)&&t.dueDate);
  const byProj=useMemo(()=>{const m:Record<string,Task[]>={};active.forEach(t=>{if(!m[t.projectId])m[t.projectId]=[];m[t.projectId].push(t);});return m;},[active]);
  const dayOff=(d:string)=>Math.max(0,Math.min(total-1,Math.floor((new Date(d).getTime()-start.getTime())/86400000)));
  return(
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="flex mb-3 ml-36" style={{borderBottom:`1px solid ${C.border}`}}>
          {Array.from({length:4}).map((_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i*7);return(
            <div key={i} className="flex-1 text-sm pb-2 pl-1" style={{borderLeft:`1px solid ${C.border}`,color:C.muted}}>
              {d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
            </div>
          );})}</div>
        {projects.map(p=>{
          const pt=byProj[p.id];if(!pt)return null;
          return(
            <div key={p.id} className="flex items-center mb-2">
              <div className="w-36 flex-shrink-0 text-sm truncate flex items-center gap-1" style={{color:p.color}}>
                <span>{p.emoji}</span>{p.name}
              </div>
              <div className="flex-1 relative h-7">
                {pt.map(t=>{
                  const pct=(dayOff(t.dueDate!)/total)*100;
                  return(
                    <div key={t.id} onClick={()=>onTaskClick(t)} title={t.title}
                      className="absolute top-1 h-5 min-w-[5px] cursor-pointer hover:opacity-70 transition-opacity"
                      style={{left:`${pct}%`,backgroundColor:PRIORITY_CFG[t.priority].color,border:`1px solid ${STATUS_CFG[t.status].color}`}}>
                      <span className="ml-1 text-sm hidden md:inline font-bold" style={{color:C.bg}}>{t.title.slice(0,14)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FILTERED VIEWS ───────────────────────────────────────────
function FilteredView({title,color,icon:Icon,desc,tasks,onTaskClick,onNewTask,empty}:{
  title:string;color:string;icon:React.ComponentType<{size?:number}>;desc:string;
  tasks:Task[];onTaskClick:(t:Task)=>void;onNewTask?:()=>void;empty:string;
}){
  return(
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 flex items-center justify-between gap-4" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <div>
          <div className="flex items-center gap-2 mb-0.5"><Icon size={12}/>
            <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color}}>{title}</h1>
          </div>
          <p className="text-sm" style={{color:C.muted}}>{desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-['VT323']" style={{color}}>({tasks.length})</span>
          {onNewTask&&<Btn onClick={onNewTask} sz="sm"><Plus size={12}/> New</Btn>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length===0
          ?<div className="flex flex-col items-center justify-center h-full" style={{color:C.muted}}>
            <div className="text-3xl mb-3">{empty}</div><div className="text-sm">Clear skies, adventurer.</div>
           </div>
          :tasks.map(t=><TaskRow key={t.id} task={t} onClick={()=>onTaskClick(t)}/>)
        }
      </div>
    </div>
  );
}

// ─── PROJECT GROUP ────────────────────────────────────────────
function ProjectGroupView({tasks,onTaskClick,projects}:{tasks:Task[];onTaskClick:(t:Task)=>void;projects:Project[]}){
  const active=tasks.filter(t=>t.status!=="archived");
  return(
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {projects.map(p=>{
          const pt=active.filter(t=>t.projectId===p.id);
          return(
            <div key={p.id}>
              <div className="flex items-center gap-3 mb-2 pb-2" style={{borderBottom:`2px solid ${p.color}`}}>
                <span className="text-xl">{p.emoji}</span>
                <span className="text-base" style={{color:p.color}}>{p.name}</span>
                <span className="text-sm" style={{color:C.muted}}>{p.category} ({pt.length})</span>
                <div className="ml-auto"><PixBar value={p.completedTasks} max={p.totalTasks} color={p.color} blocks={10}/></div>
              </div>
              {pt.length===0?<div className="text-sm py-3 text-center" style={{color:C.muted}}>No active quests</div>:pt.map(t=><TaskRow key={t.id} task={t} onClick={()=>onTaskClick(t)}/>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── HALL OF RECORDS ──────────────────────────────────────────
function ArchiveView({tasks,onTaskClick}:{tasks:Task[];onTaskClick:(t:Task)=>void}){
  const archived=tasks.filter(t=>t.status==="done"||t.status==="archived")
    .sort((a,b)=>new Date(b.completedAt||b.createdAt).getTime()-new Date(a.completedAt||a.createdAt).getTime());
  return(
    <div className="flex flex-col h-full">
      <div className="px-6 py-2" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <p className="text-sm" style={{color:C.muted}}>{archived.length} completed quests chronicled</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {archived.map(t=>{
          const xpVal=calcXP(t.priority,t.storyPoints,!isOverdue(t.completedAt));
          return(
            <div key={t.id} onClick={()=>onTaskClick(t)}
              className="flex items-center gap-3 px-4 py-2 cursor-pointer transition-all opacity-60 hover:opacity-100"
              style={{borderBottom:`1px solid ${C.border}`}}
              onMouseEnter={e=>(e.currentTarget.style.backgroundColor=C.nested)}
              onMouseLeave={e=>(e.currentTarget.style.backgroundColor="transparent")}>
              <span style={{color:C.green}}>✓</span><span className="text-sm">{TYPE_CFG[t.type].emoji}</span>
              <span className="flex-1 text-sm truncate line-through" style={{color:C.muted}}>{t.title}</span>
              <span className="text-sm" style={{color:C.muted}}>{t.project}</span>
              <span className="text-sm font-bold" style={{color:C.xpGold}}>+{xpVal} XP</span>
              <span className="text-sm" style={{color:C.green}}>{fmtDate(t.completedAt)}</span>
            </div>
          );
        })}
        {archived.length===0&&<div className="text-center text-base py-20" style={{color:C.muted}}>[ HALL IS EMPTY ]</div>}
      </div>
    </div>
  );
}

// ─── TASKS (tabbed) ───────────────────────────────────────────
function TasksView({tasks,onTaskClick,onNewTask,projects}:{tasks:Task[];onTaskClick:(t:Task)=>void;onNewTask:()=>void;projects:Project[]}){
  const[tab,setTab]=useState<TaskTab>("kanban");
  const[listMode,setListMode]=useState<"list"|"table">("list");

  const TABS:[TaskTab,string,string,React.ComponentType<{size?:number}>][]=[
    ["kanban",   "⊞","KANBAN",    Grid3X3],
    ["list",     "≡","LIST",      List],
    ["calendar", "◫","CALENDAR",  Calendar],
    ["timeline", "⇥","TIMELINE",  GitBranch],
    ["by-project","◧","PROJECTS", FolderOpen],
    ["archive",  "📖","ARCHIVE",  BookOpen],
  ];

  return(
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-2 pt-2" style={{borderBottom:`2px solid ${C.border}`,backgroundColor:C.nested}}>
        {TABS.map(([id,shape,label])=>{
          const on=tab===id;
          return(
            <button key={id} onClick={()=>setTab(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-['VT323'] whitespace-nowrap transition-all"
              style={{color:on?C.gold:C.muted,backgroundColor:on?C.panel:"transparent",
                borderBottom:on?`2px solid ${C.gold}`:"2px solid transparent",
                marginBottom:on?"-2px":"0"}}>
              <span style={{color:on?C.gold:C.dim}}>{shape}</span>{label}
            </button>
          );
        })}
        {tab==="list"&&(
          <div className="ml-auto mr-2 flex items-center gap-0" style={{border:`1px solid ${C.border}`}}>
            <button onClick={()=>setListMode("list")}
              className="flex items-center gap-1 px-2 py-0.5 text-sm font-['VT323'] transition-colors"
              style={{backgroundColor:listMode==="list"?C.panel:"transparent",color:listMode==="list"?C.gold:C.muted}}>
              <List size={10}/> List
            </button>
            <button onClick={()=>setListMode("table")}
              className="flex items-center gap-1 px-2 py-0.5 text-sm font-['VT323'] transition-colors"
              style={{backgroundColor:listMode==="table"?C.panel:"transparent",color:listMode==="table"?C.gold:C.muted}}>
              <Table2 size={10}/> Table
            </button>
          </div>
        )}
        {tab!=="list"&&<div className="ml-auto mr-2"><Btn onClick={onNewTask} sz="sm"><Plus size={12}/> New Quest</Btn></div>}
      </div>
      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab==="kanban"   &&<KanbanView tasks={tasks} onTaskClick={onTaskClick} onNewTask={onNewTask} noHeader/>}
        {tab==="list"     &&listMode==="list" &&<ListView  tasks={tasks} onTaskClick={onTaskClick} onNewTask={onNewTask} noHeader/>}
        {tab==="list"     &&listMode==="table"&&<TableView tasks={tasks} onTaskClick={onTaskClick} noHeader/>}
        {tab==="calendar" &&<CalendarView tasks={tasks} onTaskClick={onTaskClick}/>}
        {tab==="timeline" &&<TimelineView tasks={tasks} onTaskClick={onTaskClick} projects={projects}/>}
        {tab==="by-project"&&<ProjectGroupView tasks={tasks} onTaskClick={onTaskClick} projects={projects}/>}
        {tab==="archive"  &&<ArchiveView tasks={tasks} onTaskClick={onTaskClick}/>}
      </div>
    </div>
  );
}

// ─── PROJECTS ─────────────────────────────────────────────────
function ProjectsView({tasks,projects,onNewProject}:{tasks:Task[];projects:Project[];onNewProject:()=>void}){
  return(
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 flex items-center justify-between" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>◈ PROJECTS</h1>
        <Btn sz="sm" onClick={onNewProject}><Plus size={12}/> New Project</Btn>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map(p=>{
            const pt=tasks.filter(t=>t.projectId===p.id);
            const ip=pt.filter(t=>t.status==="in-progress").length;
            const wa=pt.filter(t=>t.status==="waiting-external").length;
            const bl=pt.filter(t=>t.status==="blocked").length;
            const pct=p.totalTasks>0?Math.round((p.completedTasks/p.totalTasks)*100):0;
            return(
              <div key={p.id} className="p-5"
                style={{backgroundColor:C.panel,border:`2px solid ${C.border}`,borderLeftWidth:"4px",borderLeftColor:p.color}}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{p.emoji}</span>
                      <span className="text-base" style={{color:C.text}}>{p.name}</span>
                      <span className="text-sm" style={{color:C.muted}}>{p.category}</span>
                    </div>
                    <p className="text-sm" style={{color:C.muted}}>{p.description}</p>
                  </div>
                  <span className="text-sm px-1.5 py-0.5 whitespace-nowrap" style={{color:p.color,border:`1px solid ${p.color}`}}>{p.status.toUpperCase()}</span>
                </div>
                <PixBar value={p.completedTasks} max={p.totalTasks} color={p.color} blocks={16}/>
                <div className="text-sm mt-1 mb-3" style={{color:C.muted}}>{pct}% — {p.completedTasks}/{p.totalTasks}</div>
                <div className="flex gap-4 text-sm flex-wrap">
                  {ip>0&&<span style={{color:C.yellow}}>▶ {ip} in progress</span>}
                  {wa>0&&<span style={{color:C.violet}}>⏸ {wa} waiting</span>}
                  {bl>0&&<span style={{color:C.red}}>✕ {bl} blocked</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SPRINTS ──────────────────────────────────────────────────
function SprintsView({sprints,tasks}:{sprints:Sprint[];tasks:Task[]}){
  const[sel,setSel]=useState(sprints.find(s=>s.status==="active")?.id||sprints[0]?.id);
  const sp=sprints.find(s=>s.id===sel)!;
  const st=sp?tasks.filter(t=>sp.taskIds.includes(t.id)):[];
  const dn=st.filter(t=>t.status==="done").length;
  const sCol:Record<string,string>={active:C.teal,completed:C.muted,planning:C.violet};
  return(
    <div className="flex flex-col h-full">
      <div className="px-6 py-3" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>⚡ SPRINTS</h1>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-60 flex-shrink-0 overflow-y-auto" style={{borderRight:`1px solid ${C.border}`}}>
          {sprints.map(s=>(
            <button key={s.id} onClick={()=>setSel(s.id)}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{borderBottom:`1px solid ${C.border}`,backgroundColor:sel===s.id?C.panel:"transparent",borderLeft:sel===s.id?`2px solid ${C.gold}`:"2px solid transparent"}}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm px-1" style={{color:sCol[s.status],border:`1px solid ${sCol[s.status]}`}}>{s.status.toUpperCase()}</span>
              </div>
              <div className="text-sm" style={{color:C.text}}>{s.name}</div>
              <div className="text-sm" style={{color:C.muted}}>{fmtDate(s.startDate)} → {fmtDate(s.endDate)}</div>
            </button>
          ))}
        </div>
        {sp&&(
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm px-2 py-0.5" style={{color:sCol[sp.status],border:`1px solid ${sCol[sp.status]}`}}>{sp.status.toUpperCase()}</span>
                <h2 className="text-base" style={{color:C.xpGold}}>{sp.name}</h2>
              </div>
              <p className="text-sm italic mb-4" style={{color:C.muted}}>"{sp.goal}"</p>
              <div className="flex gap-6 text-sm mb-3" style={{color:C.muted}}>
                <span>{fmtDate(sp.startDate)} — {fmtDate(sp.endDate)}</span>
                <span style={{color:C.teal}}>{dn}/{st.length} done</span>
              </div>
              <PixBar value={dn} max={Math.max(st.length,1)} color={C.teal} blocks={20}/>
            </div>
            {st.length===0?<div className="text-center text-base py-12" style={{color:C.muted}}>[ NO QUESTS ]</div>:
              <>
                <Divider title={`Sprint Quests (${st.length})`}/>
                {st.map(t=>(
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2" style={{borderBottom:`1px solid ${C.border}`}}>
                    <SBadge status={t.status}/><PPip priority={t.priority}/>
                    <span className="flex-1 text-sm truncate" style={{color:C.text}}>{t.title}</span>
                    <span className="text-sm" style={{color:C.muted}}>{t.storyPoints} SP</span>
                    <span className="text-sm" style={{color:C.muted}}>{fmtDate(t.dueDate)}</span>
                  </div>
                ))}
              </>
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────
function AchievementsView({achievements,tasks}:{achievements:Achievement[];tasks:Task[]}){
  const[filter,setFilter]=useState<"all"|"unlocked"|"locked">("all");
  const cc:Record<string,string>={combat:C.red,exploration:C.teal,crafting:C.yellow,social:C.violet};
  const unlocked=achievements.filter(a=>a.unlocked).length;
  const earnedXP=achievements.filter(a=>a.unlocked).reduce((s,a)=>s+a.xp,0);
  const filtered=achievements.filter(a=>filter==="all"?true:filter==="unlocked"?a.unlocked:!a.unlocked);
  return(
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 flex items-center justify-between" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <div>
          <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>🏆 ACHIEVEMENTS</h1>
          <p className="text-sm mt-0.5" style={{color:C.muted}}>{unlocked}/{achievements.length} unlocked · {earnedXP} XP earned</p>
        </div>
        <div className="flex gap-1">
          {(["all","unlocked","locked"] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className="px-3 py-0.5 text-sm font-['VT323'] transition-colors"
              style={{border:`1px solid ${filter===f?C.gold:C.border}`,color:filter===f?C.gold:C.muted,backgroundColor:filter===f?C.panel:"transparent"}}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {(["combat","exploration","crafting","social"] as const).map(cat=>{
          const ca=filtered.filter(a=>a.category===cat);if(!ca.length)return null;
          return(
            <div key={cat} className="mb-6">
              <Divider title={`${cat.toUpperCase()} DEEDS`}/>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {ca.map(a=>{
                  const prog=!a.unlocked?getAchievementProgress(a.id,tasks):null;
                  const progPct=prog?Math.min(1,prog.current/prog.max):0;
                  return(
                  <div key={a.id} className="p-4 flex flex-col"
                    style={{backgroundColor:C.panel,border:`2px solid ${a.unlocked?C.gold:C.border}`,
                      opacity:a.unlocked?1:prog&&prog.current>0?0.85:0.5}}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-3xl leading-none">{a.icon}</span>
                      {a.unlocked
                        ?<span className="text-sm px-1.5 py-0.5" style={{color:C.teal,border:`1px solid ${C.teal}`}}>✓ DONE</span>
                        :prog&&prog.current>0
                          ?<span className="text-sm" style={{color:C.muted}}>{prog.current}/{prog.max}</span>
                          :<Lock size={12} style={{color:C.dim}}/>
                      }
                    </div>
                    <div className="text-sm mb-1 font-bold" style={{color:a.unlocked?C.text:C.muted}}>{a.name}</div>
                    <p className="text-sm mb-3 leading-tight flex-1" style={{color:C.dim}}>{a.description}</p>
                    {prog&&prog.current>0&&!a.unlocked&&(
                      <div className="mb-2">
                        <div className="flex gap-[2px] mb-1">
                          {Array.from({length:10}).map((_,i)=>(
                            <div key={i} className="flex-1 h-1.5"
                              style={{backgroundColor:i<Math.round(progPct*10)?cc[cat]:C.nested,
                                border:`1px solid ${i<Math.round(progPct*10)?cc[cat]:C.border}`}}/>
                          ))}
                        </div>
                        <div className="text-sm" style={{color:C.dim}}>{Math.round(progPct*100)}% complete</div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-sm font-bold" style={{color:cc[cat]}}>+{a.xp} XP</span>
                      {a.unlocked&&<span className="text-sm" style={{color:C.muted}}>{fmtDate(a.unlockedAt)}</span>}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RECAP CUTSCENE ───────────────────────────────────────────
interface RecapData {
  period:"week"|"month";
  done:number; prevDone:number; created:number;
  xpEarned:number; streak:number;
  topProject:{name:string;emoji:string;color:string};
  grade:"S"|"A"|"B"|"C"|"D";
}
function useCountUp(target:number,duration:number,active:boolean){
  const[v,setV]=useState(0);
  useEffect(()=>{
    if(!active||target===0){setV(active?0:0);return;}
    let cur=0;
    const step=target/(duration/16);
    const id=setInterval(()=>{cur=Math.min(cur+step,target);setV(Math.floor(cur));if(cur>=target)clearInterval(id);},16);
    return()=>clearInterval(id);
  },[active,target,duration]);
  return v;
}
const GRADE_CFG:{[k:string]:{color:string;label:string;sub:string}}={
  S:{color:C.xpGold,  label:"S RANK",sub:"LEGENDARY WEEK"},
  A:{color:C.green,   label:"A RANK",sub:"OUTSTANDING"},
  B:{color:C.teal,    label:"B RANK",sub:"SOLID PROGRESS"},
  C:{color:C.yellow,  label:"C RANK",sub:"KEEP PUSHING"},
  D:{color:C.muted,   label:"D RANK",sub:"ROUGH WEEK"},
};
function RecapCutscene({data,onClose}:{data:RecapData;onClose:()=>void}){
  const[phase,setPhase]=useState(0);
  // Phase timeline: 0=intro 1=title 2=done 3=xp 4=project 5=streak 6=grade 7=done-reveal
  useEffect(()=>{
    const delays=[400,900,1700,2500,3200,3900,4700];
    const ids=delays.map((ms,i)=>setTimeout(()=>setPhase(i+1),ms));
    const closeId=setTimeout(()=>{},999999);
    return()=>{ids.forEach(clearTimeout);clearTimeout(closeId);};
  },[]);
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==="Escape"||e.key==="Enter"||e.key===" ")onClose();};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[onClose]);

  const cntDone   =useCountUp(data.done,   900, phase>=2);
  const cntXP     =useCountUp(data.xpEarned,900,phase>=3);
  const cntStreak =useCountUp(data.streak,  600,phase>=5);
  const g=GRADE_CFG[data.grade];
  const delta=data.done-data.prevDone;
  const up=delta>=0;

  const SlideCard=({show,children,delay=0}:{show:boolean;children:React.ReactNode;delay?:number})=>(
    <div style={{
      opacity:show?1:0,transform:show?"translateY(0)":"translateY(18px)",
      transition:`opacity 0.45s ${delay}ms ease, transform 0.45s ${delay}ms ease`,
      pointerEvents:show?"auto":"none",
    }}>{children}</div>
  );

  return(
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{backgroundColor:"rgba(5,7,12,0.97)"}}>
      <style>{`
        @keyframes scanline{0%{background-position:0 0}100%{background-position:0 100vh}}
        @keyframes gradeFlash{0%,100%{opacity:1}40%{opacity:0.35}}
        @keyframes recapTitle{0%{letter-spacing:0.5em;opacity:0}100%{letter-spacing:0.15em;opacity:1}}
      `}</style>
      {/* scanlines overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.18) 3px,rgba(0,0,0,0.18) 4px)",
        zIndex:1,
      }}/>

      <div className="relative z-10 w-full max-w-lg px-6 flex flex-col items-center gap-7">

        {/* ── HEADER ───────────────────────────────────── */}
        <SlideCard show={phase>=1}>
          <div className="text-center">
            <div style={{
              fontFamily:"'Press Start 2P',monospace",fontSize:"9px",color:C.muted,
              letterSpacing:"0.3em",marginBottom:10,
              animation:phase>=1?"recapTitle 0.6s ease forwards":"none",
            }}>
              {data.period==="week"?"◈ WEEKLY RECAP":"◈ MONTHLY RECAP"}
            </div>
            <div style={{
              fontFamily:"'Press Start 2P',monospace",fontSize:"22px",color:C.gold,
              textShadow:`0 0 30px ${C.gold}60`,letterSpacing:"0.15em",
            }}>
              {data.period==="week"?"WEEK":"MONTH"} COMPLETE
            </div>
          </div>
        </SlideCard>

        {/* ── STAT GRID ────────────────────────────────── */}
        <div className="w-full grid grid-cols-2 gap-3">
          {/* Quests slain */}
          <SlideCard show={phase>=2}>
            <div className="p-5 text-center" style={{backgroundColor:C.panel,border:`2px solid ${C.teal}`,boxShadow:`0 0 16px ${C.teal}20`}}>
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"32px",color:C.teal,lineHeight:1}}>{cntDone}</div>
              <div className="text-sm mt-2 tracking-widest" style={{color:C.muted}}>QUESTS SLAIN</div>
              <div className="text-sm mt-1" style={{color:up?C.green:C.red}}>
                {up?"↑":"↓"} {Math.abs(delta)} vs last {data.period}
              </div>
            </div>
          </SlideCard>

          {/* XP earned */}
          <SlideCard show={phase>=3} delay={60}>
            <div className="p-5 text-center" style={{backgroundColor:C.panel,border:`2px solid ${C.xpGold}`,boxShadow:`0 0 16px ${C.xpGold}20`}}>
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"32px",color:C.xpGold,lineHeight:1}}>{cntXP}</div>
              <div className="text-sm mt-2 tracking-widest" style={{color:C.muted}}>XP EARNED</div>
              <div className="text-sm mt-1" style={{color:C.coin}}>🪙 +{Math.floor(data.xpEarned/8)} coins</div>
            </div>
          </SlideCard>

          {/* Top project */}
          <SlideCard show={phase>=4}>
            <div className="p-5 text-center" style={{backgroundColor:C.panel,border:`2px solid ${data.topProject.color}`,boxShadow:`0 0 16px ${data.topProject.color}20`}}>
              <div style={{fontSize:"32px",lineHeight:1}}>{data.topProject.emoji}</div>
              <div className="text-sm mt-2 font-bold" style={{color:C.text}}>{data.topProject.name}</div>
              <div className="text-sm mt-1 tracking-widest" style={{color:C.muted}}>TOP PROJECT</div>
            </div>
          </SlideCard>

          {/* Streak */}
          <SlideCard show={phase>=5} delay={60}>
            <div className="p-5 text-center" style={{backgroundColor:C.panel,border:`2px solid ${C.flame}`,boxShadow:`0 0 16px ${C.flame}20`}}>
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"32px",color:C.flame,lineHeight:1}}>{cntStreak}</div>
              <div className="text-sm mt-2 tracking-widest" style={{color:C.muted}}>DAY STREAK</div>
              <div className="text-sm mt-1" style={{color:C.muted}}>{streakViz(data.streak).icon} {streakViz(data.streak).label}</div>
            </div>
          </SlideCard>
        </div>

        {/* ── GRADE ────────────────────────────────────── */}
        <SlideCard show={phase>=6}>
          <div className="flex items-center gap-6 px-8 py-5 w-full" style={{
            backgroundColor:C.panel,
            border:`3px solid ${g.color}`,
            boxShadow:`0 0 32px ${g.color}40`,
            animation:phase>=6?"gradeFlash 0.6s ease 1":"none",
          }}>
            <div style={{
              fontFamily:"'Press Start 2P',monospace",fontSize:"48px",color:g.color,
              textShadow:`0 0 24px ${g.color}80`,lineHeight:1,flexShrink:0,
            }}>{data.grade}</div>
            <div>
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:g.color}}>{g.label}</div>
              <div className="text-sm mt-1" style={{color:C.muted}}>{g.sub}</div>
              <div className="text-sm mt-2" style={{color:C.dim}}>
                {data.done} done · {data.created} created · {Math.round((data.done/Math.max(data.created,1))*100)}% velocity
              </div>
            </div>
          </div>
        </SlideCard>

        {/* ── CLOSE ────────────────────────────────────── */}
        <SlideCard show={phase>=7}>
          <div className="flex flex-col items-center gap-2">
            <button onClick={onClose}
              className="px-8 py-3 text-sm tracking-widest font-['VT323'] transition-all"
              style={{
                backgroundColor:C.gold,color:C.bg,
                fontFamily:"'Press Start 2P',monospace",fontSize:"9px",
                border:`2px solid ${C.gold}`,
              }}
              onMouseEnter={e=>{e.currentTarget.style.backgroundColor="transparent";e.currentTarget.style.color=C.gold;}}
              onMouseLeave={e=>{e.currentTarget.style.backgroundColor=C.gold;e.currentTarget.style.color=C.bg;}}>
              ▸ CONTINUE
            </button>
            <div className="text-sm" style={{color:C.dim,fontFamily:"'Press Start 2P',monospace",fontSize:"7px",animation:"pixelPulse 1.5s ease-in-out infinite"}}>
              PRESS ENTER · ESC · OR CLICK
            </div>
          </div>
        </SlideCard>
      </div>
    </div>
  );
}

// ─── PROGRESS (Statistics) ────────────────────────────────────
const TTS={backgroundColor:C.panel,border:`2px solid ${C.gold}`,color:C.text,fontFamily:"VT323,monospace",fontSize:"14px"};
function StatisticsView({tasks,projects,xp,streak}:{tasks:Task[];projects:Project[];xp:number;streak:number}){
  const[showRecap,setShowRecap]=useState<"week"|"month"|null>(null);
  const weekly=    [{day:"Mon",done:2,c:3},{day:"Tue",done:4,c:2},{day:"Wed",done:1,c:5},{day:"Thu",done:6,c:2},{day:"Fri",done:3,c:4},{day:"Sat",done:5,c:1},{day:"Sun",done:2,c:0}];
  const lastWeekly=[{day:"Mon",done:1,c:2},{day:"Tue",done:3,c:1},{day:"Wed",done:2,c:3},{day:"Thu",done:4,c:2},{day:"Fri",done:2,c:1},{day:"Sat",done:1,c:2},{day:"Sun",done:1,c:0}];

  // Week-over-week: derive from tasks data using rolling 7-day windows
  const msDay=86400_000;
  const wkAgo =new Date(Date.now()-7 *msDay).toISOString().slice(0,10);
  const twoWkAgo=new Date(Date.now()-14*msDay).toISOString().slice(0,10);
  const createdThis =tasks.filter(t=>t.createdAt  >=wkAgo).length;
  const createdPrev =tasks.filter(t=>t.createdAt  >=twoWkAgo&&t.createdAt  <wkAgo).length;
  const completedThis=tasks.filter(t=>t.completedAt&&t.completedAt>=wkAgo).length;
  const completedPrev=tasks.filter(t=>t.completedAt&&t.completedAt>=twoWkAgo&&t.completedAt<wkAgo).length;
  // From mock chart data (weekly throughput is already modelled)
  const doneThis =weekly.reduce((s,r)=>s+r.done,0);
  const donePrev =lastWeekly.reduce((s,r)=>s+r.done,0);
  const createdThis7=weekly.reduce((s,r)=>s+r.c,0);

  // Recap data assembly
  const recapXP=tasks.filter(t=>t.completedAt&&t.completedAt>=wkAgo)
    .reduce((s,t)=>s+calcXP(t.priority,t.storyPoints,true),0)
    +doneThis*22; // blend mock weekly throughput into XP estimate
  const topProj=projects.reduce((best,p)=>p.completedTasks>best.completedTasks?p:best,projects[0]);
  const velocity=doneThis/Math.max(createdThis7,1);
  const grade:RecapData["grade"]=velocity>=1?"S":velocity>=0.7?"A":velocity>=0.45?"B":velocity>=0.25?"C":"D";
  function buildRecap(period:"week"|"month"):RecapData{
    return{period,done:doneThis,prevDone:donePrev,created:createdThis7,
      xpEarned:recapXP,streak,
      topProject:{name:topProj?.name??"—",emoji:topProj?.emoji??"📁",color:topProj?.color??C.muted},
      grade};
  }

  const byProj=projects.map(p=>({name:p.name.split(" ")[0],done:p.completedTasks,active:p.totalTasks-p.completedTasks}));
  const byPri=[
    {name:"P0",value:tasks.filter(t=>t.priority==="p0").length,fill:C.red},
    {name:"P1",value:tasks.filter(t=>t.priority==="p1").length,fill:C.yellow},
    {name:"P2",value:tasks.filter(t=>t.priority==="p2").length,fill:C.teal},
    {name:"P3",value:tasks.filter(t=>t.priority==="p3").length,fill:C.muted},
    {name:"P4",value:tasks.filter(t=>t.priority==="p4").length,fill:C.dim},
  ];
  const byType=Object.entries(TYPE_CFG).map(([type,{label,emoji}])=>({name:label,value:tasks.filter(t=>t.type===type).length,emoji})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value).slice(0,6);
  const kpis=[
    {l:"TOTAL",  v:tasks.length,                                        c:C.text},
    {l:"DONE",   v:tasks.filter(t=>t.status==="done").length,           c:C.green},
    {l:"ACTIVE", v:tasks.filter(t=>t.status==="in-progress").length,    c:C.yellow},
    {l:"WAITING",v:tasks.filter(t=>t.status==="waiting-external").length,c:C.violet},
  ];
  const barC=[C.red,C.yellow,C.teal,C.violet,C.cyan,C.muted];
  return(
    <div className="flex flex-col h-full">
      {showRecap&&<RecapCutscene data={buildRecap(showRecap)} onClose={()=>setShowRecap(null)}/>}
      <div className="px-6 py-3 flex items-center justify-between" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>📊 PROGRESS</h1>
        <div className="flex gap-2">
          <Btn sz="sm" v="secondary" onClick={()=>setShowRecap("week")}>📜 Weekly Recap</Btn>
          <Btn sz="sm" v="secondary" onClick={()=>setShowRecap("month")}>📜 Monthly Recap</Btn>
        </div>
      </div>
      {/* ── VS LAST WEEK STRIP ─────────────────────────────────── */}
      {(()=>{
        type WoW={label:string;icon:string;now:number;prev:number};
        const metrics:WoW[]=[
          {label:"throughput",icon:"✓",now:doneThis,   prev:donePrev},
          {label:"created",   icon:"＋",now:createdThis,prev:createdPrev},
          {label:"completed", icon:"◆",now:completedThis,prev:completedPrev},
        ];
        return(
          <div className="px-6 py-2 flex items-center gap-1 flex-wrap" style={{backgroundColor:C.nested,borderBottom:`1px solid ${C.border}`}}>
            <span className="text-sm tracking-widest mr-3" style={{color:C.dim,fontFamily:"'Press Start 2P',monospace",fontSize:"7px",flexShrink:0}}>VS LAST WEEK</span>
            {metrics.map(({label,icon,now,prev})=>{
              const delta=now-prev;
              const pct=prev>0?Math.round(Math.abs(delta/prev)*100):now>0?100:0;
              const up=delta>0,flat=delta===0;
              const dc=flat?C.muted:up?C.green:C.red;
              return(
                <div key={label} className="flex items-center gap-1.5 text-sm mr-4" style={{color:C.muted}}>
                  <span style={{color:C.dim}}>{icon}</span>
                  <span>{label}:</span>
                  <span style={{color:C.text}}>{now}</span>
                  <span style={{color:C.dim}}>vs {prev}</span>
                  <span style={{
                    color:dc,border:`1px solid ${dc}`,padding:"0 5px",
                    fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                    opacity:flat?0.5:1,
                  }}>
                    {flat?"—":up?`↑+${delta}`:` ↓${delta}`}{!flat&&` (${pct}%)`}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map(k=>(
            <div key={k.l} className="p-4 text-center" style={{backgroundColor:C.panel,border:`2px solid ${C.border}`}}>
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"24px",color:k.c}}>{k.v}</div>
              <div className="text-sm tracking-widest mt-2" style={{color:C.muted}}>{k.l}</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="p-4" style={{backgroundColor:C.panel,border:`2px solid ${C.border}`}}>
            <div className="flex items-baseline justify-between mb-4">
              <div className="text-sm tracking-widest" style={{color:C.teal}}>▸ WEEKLY THROUGHPUT</div>
              <div className="flex items-center gap-3 text-sm" style={{color:C.dim}}>
                <span style={{display:"inline-block",width:10,height:10,backgroundColor:C.teal,marginRight:3}}/>this week
                <span style={{display:"inline-block",width:10,height:10,backgroundColor:C.dim,marginRight:3}}/>last week
              </div>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <ReBarChart data={weekly.map((w,i)=>({...w,prevDone:lastWeekly[i].done}))}>
                <CartesianGrid strokeDasharray="4 4" stroke={C.border}/>
                <XAxis dataKey="day" stroke={C.border} tick={{fill:C.muted,fontFamily:"VT323",fontSize:13}}/>
                <YAxis stroke={C.border} tick={{fill:C.muted,fontFamily:"VT323",fontSize:13}}/>
                <Tooltip contentStyle={TTS}/>
                <Bar dataKey="prevDone" name="Last Week" fill={C.dim} opacity={0.5}/>
                <Bar dataKey="done" name="This Week" fill={C.teal}/>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
          <div className="p-4" style={{backgroundColor:C.panel,border:`2px solid ${C.border}`}}>
            <div className="text-sm tracking-widest mb-4" style={{color:C.teal}}>▸ BY PROJECT</div>
            <ResponsiveContainer width="100%" height={170}>
              <ReBarChart data={byProj} layout="vertical">
                <CartesianGrid strokeDasharray="4 4" stroke={C.border}/>
                <XAxis type="number" stroke={C.border} tick={{fill:C.muted,fontFamily:"VT323",fontSize:11}}/>
                <YAxis dataKey="name" type="category" width={55} stroke={C.border} tick={{fill:C.muted,fontFamily:"VT323",fontSize:11}}/>
                <Tooltip contentStyle={TTS}/>
                <Bar dataKey="done" name="Done" stackId="a" fill={C.teal}/>
                <Bar dataKey="active" name="Active" stackId="a" fill={C.border}/>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
          <div className="p-4" style={{backgroundColor:C.panel,border:`2px solid ${C.border}`}}>
            <div className="text-sm tracking-widest mb-4" style={{color:C.teal}}>▸ BY PRIORITY</div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={130} height={130}>
                <PieChart><Pie data={byPri} dataKey="value" cx="50%" cy="50%" outerRadius={60} paddingAngle={2}>
                  {byPri.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                </Pie><Tooltip contentStyle={TTS}/></PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {byPri.map(p=>(
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 flex-shrink-0" style={{backgroundColor:p.fill}}/>
                    <span style={{color:C.muted}}>{p.name}</span>
                    <span className="ml-auto pl-2" style={{color:C.text}}>{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4" style={{backgroundColor:C.panel,border:`2px solid ${C.border}`}}>
            <div className="text-sm tracking-widest mb-4" style={{color:C.teal}}>▸ BY TYPE</div>
            <div className="space-y-2">
              {byType.map((t,i)=>(
                <div key={t.name} className="flex items-center gap-3">
                  <span className="text-sm w-5 flex-shrink-0">{t.emoji}</span>
                  <span className="text-sm w-24 truncate" style={{color:C.muted}}>{t.name}</span>
                  <div className="flex-1 h-3" style={{backgroundColor:C.nested}}>
                    <div className="h-full" style={{width:`${(t.value/tasks.length)*100}%`,backgroundColor:barC[i]}}/>
                  </div>
                  <span className="text-sm w-4 text-right" style={{color:C.text}}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────
function SettingsView(){
  const[n,setN]=useState(true);const[s,setS]=useState(true);const[m,setM]=useState(false);
  const[cp,setCp]=useState(false);const[aa,setAa]=useState(true);const[dv,setDv]=useState("dashboard");
  const Tog=({val,onChange,label,desc}:{val:boolean;onChange:(v:boolean)=>void;label:string;desc:string})=>(
    <div className="flex items-start justify-between py-3" style={{borderBottom:`1px solid ${C.border}`}}>
      <div><div className="text-sm" style={{color:C.text}}>{label}</div><div className="text-sm" style={{color:C.muted}}>{desc}</div></div>
      <button onClick={()=>onChange(!val)}
        className="w-11 h-5 relative flex-shrink-0 ml-4 mt-0.5 transition-colors"
        style={{backgroundColor:val?C.gold:C.nested,border:`2px solid ${val?C.gold:C.border}`}}>
        <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 transition-transform"
          style={{backgroundColor:C.text,transform:val?"translateX(22px)":"translateX(0)"}}/>
      </button>
    </div>
  );
  return(
    <div className="flex flex-col h-full">
      <div className="px-6 py-3" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>⚙ SETTINGS</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        <Divider title="EXPERIENCE"/>
        <Tog val={n}  onChange={setN}  label="Notifications" desc="Overdue and sprint deadline alerts"/>
        <Tog val={s}  onChange={setS}  label="Sound Effects"  desc="Subtle chimes on task complete and level-up"/>
        <Tog val={m}  onChange={setM}  label="Reduce Motion"  desc="Shortens all animation durations"/>
        <Tog val={cp} onChange={setCp} label="Compact View"   desc="Tighter spacing in list and table views"/>
        <Tog val={aa} onChange={setAa} label="Auto-Archive"   desc="Archive completed tasks after 7 days"/>
        <div className="py-3" style={{borderBottom:`1px solid ${C.border}`}}>
          <div className="text-sm mb-1" style={{color:C.text}}>Default View</div>
          <div className="text-sm mb-2" style={{color:C.muted}}>Screen shown on app open</div>
          <Sel value={dv} onChange={e=>setDv(e.target.value)} style={{width:"auto"}}>
            <option value="dashboard">Command Center</option>
            <option value="today">Today</option>
            <option value="focus">Focus</option>
            <option value="kanban">Kanban</option>
          </Sel>
        </div>
        <Divider title="ACCOUNT"/>
        {[["Adventurer Name","Aric Stormcloak"],["Guild","Squad Lead · Uni · Freelancer"],["Total XP",`${MOCK_XP.toLocaleString()} XP`],["Streak",`${MOCK_STREAK} days`],["Coins",`🪙 ${MOCK_COINS}`]].map(([l,v])=>(
          <div key={l} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${C.border}`}}>
            <span className="text-sm" style={{color:C.muted}}>{l}</span>
            <span className="text-sm" style={{color:C.text}}>{v}</span>
          </div>
        ))}
        <Divider title="KEYBOARD SHORTCUTS"/>
        {[["Ctrl+K","Open command palette"],["Ctrl+N","New quest"],["Esc","Close panel / palette"]].map(([k,d])=>(
          <div key={k} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${C.border}`}}>
            <span className="text-sm" style={{color:C.muted}}>{d}</span>
            <span className="px-2 py-0 text-sm font-['VT323']" style={{backgroundColor:C.panel,border:`1px solid ${C.border}`,color:C.gold}}>{k}</span>
          </div>
        ))}
        <Divider title="DATA"/>
        <div className="flex gap-3 pt-2">
          <Btn v="secondary">Export JSON</Btn>
          <Btn v="secondary">Import Data</Btn>
          <Btn v="danger">Reset All</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── TASK PANEL (accordion) ───────────────────────────────────
function TaskPanel({task,isCreating,onClose,onSave}:{task:Task|null;isCreating:boolean;onClose:()=>void;onSave:(t:Task)=>void;}){
  const blank:Task={id:`t${Date.now()}`,title:"",description:"",status:"inbox",priority:"p2",type:"coding",effort:"m",storyPoints:0,project:"ATS Platform",projectId:"p1",sprint:null,tags:[],dueDate:null,createdAt:new Date().toISOString().slice(0,10),completedAt:null,waitingOn:null,reporter:"self",parentId:null,attachments:[],deliverables:[]};
  const[form,setForm]=useState<Task>(task||blank);
  const[tagI,setTagI]=useState("");
  useEffect(()=>{setForm(task||blank);setTagI("");},[task,isCreating]);
  const set=(k:keyof Task,v:unknown)=>setForm(f=>({...f,[k]:v}));
  const addTag=()=>{const t=tagI.trim().toLowerCase().replace(/[^a-z0-9-]/g,"");if(t&&!form.tags.includes(t))setForm(f=>({...f,tags:[...f.tags,t]}));setTagI("");};
  const lc="block text-sm tracking-widest uppercase mb-1";
  const xpP=calcXP(form.priority,form.storyPoints,true);
  const coP=calcCoins(form.priority,form.storyPoints);

  const AccS=({value,title,shape,children}:{value:string;title:string;shape:string;children:React.ReactNode})=>(
    <Accordion.Item value={value} style={{borderBottom:`1px solid ${C.border}`}}>
      <Accordion.Header>
        <Accordion.Trigger className="group w-full flex items-center justify-between px-4 py-2.5 text-left"
          style={{backgroundColor:"transparent"}}
          onMouseEnter={e=>(e.currentTarget.style.backgroundColor=C.nested)}
          onMouseLeave={e=>(e.currentTarget.style.backgroundColor="transparent")}>
          <span className="text-sm tracking-widest flex items-center gap-2">
            <span style={{color:C.gold}}>{shape}</span><span style={{color:C.muted}}>{title}</span>
          </span>
          <ChevronDown size={12} className="transition-transform duration-200 group-data-[state=open]:rotate-180" style={{color:C.muted}}/>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="px-4 pb-4 pt-1 space-y-3">{children}</Accordion.Content>
    </Accordion.Item>
  );

  return(
    <div className="flex flex-col h-full" style={{backgroundColor:C.panel}}>
      <div className="px-4 py-3 flex items-center justify-between" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:"9px",color:C.gold}}>
          {isCreating?"+NEW QUEST":"◈ QUEST DETAIL"}
        </span>
        <div className="flex items-center gap-2">
          {!isCreating&&<Btn v="ghost" sz="sm"><Pencil size={10}/></Btn>}
          {!isCreating&&<Btn v="danger" sz="sm"><Trash2 size={10}/></Btn>}
          <button onClick={onClose} className="p-1 transition-colors" style={{color:C.muted}}
            onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.muted)}>
            <X size={15}/>
          </button>
        </div>
      </div>

      {/* XP preview */}
      <div className="px-4 py-2 flex items-center gap-4 text-sm" style={{backgroundColor:C.nested,borderBottom:`1px solid ${C.border}`}}>
        <span style={{color:C.xpGold}}>⚡ +{xpP} XP on complete</span>
        <span style={{color:C.coin}}>🪙 +{coP} coins</span>
      </div>

      {/* Title + live badge preview */}
      <div className="px-4 pt-4 pb-3" style={{borderBottom:`1px solid ${C.border}`}}>
        <label className={lc} style={{color:C.muted}}>Quest Title *</label>
        <Inp value={form.title} onChange={e=>set("title",e.target.value)} placeholder="What needs to be done?"/>
      </div>
      <div className="px-4 py-2 flex gap-4" style={{borderBottom:`1px solid ${C.border}`}}>
        <SBadge status={form.status}/><PBadge priority={form.priority}/>
        <span className="text-base">{TYPE_CFG[form.type].emoji}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Accordion.Root type="multiple" defaultValue={["core"]}>
          <AccS value="core" title="CORE" shape="■">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lc} style={{color:C.muted}}>Status</label>
                <Sel value={form.status} onChange={e=>set("status",e.target.value)}>
                  {(Object.keys(STATUS_CFG) as Status[]).map(s=><option key={s} value={s}>{STATUS_CFG[s].shape} {STATUS_CFG[s].label}</option>)}
                </Sel>
              </div>
              <div><label className={lc} style={{color:C.muted}}>Priority</label>
                <Sel value={form.priority} onChange={e=>set("priority",e.target.value)}>
                  {(Object.keys(PRIORITY_CFG) as Priority[]).map(p=><option key={p} value={p}>{PRIORITY_CFG[p].shape} {PRIORITY_CFG[p].label}</option>)}
                </Sel>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lc} style={{color:C.muted}}>Type</label>
                <Sel value={form.type} onChange={e=>set("type",e.target.value)}>
                  {(Object.keys(TYPE_CFG) as TaskType[]).map(t=><option key={t} value={t}>{TYPE_CFG[t].emoji} {TYPE_CFG[t].label}</option>)}
                </Sel>
              </div>
              <div><label className={lc} style={{color:C.muted}}>Reporter</label>
                <Sel value={form.reporter} onChange={e=>set("reporter",e.target.value)}>
                  {REPORTER_OPTS.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                </Sel>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lc} style={{color:C.muted}}>Effort</label>
                <Sel value={form.effort} onChange={e=>set("effort",e.target.value)}>
                  {EFFORT_OPTS.map(e=><option key={e} value={e}>{e.toUpperCase()}</option>)}
                </Sel>
              </div>
              <div><label className={lc} style={{color:C.muted}}>Story Points</label>
                <Sel value={form.storyPoints} onChange={e=>set("storyPoints",Number(e.target.value))}>
                  {SP_OPTS.map(sp=><option key={sp} value={sp}>{sp} SP</option>)}
                </Sel>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lc} style={{color:C.muted}}>Due Date</label>
                <Inp type="date" value={form.dueDate||""} onChange={e=>set("dueDate",e.target.value||null)}/>
              </div>
              <div><label className={lc} style={{color:C.muted}}>Sprint</label>
                <Inp value={form.sprint||""} onChange={e=>set("sprint",e.target.value||null)} placeholder="Sprint..."/>
              </div>
            </div>
            {(form.status==="waiting-external"||form.status==="blocked")&&(
              <div><label className={lc} style={{color:C.muted}}>{form.status==="blocked"?"Blocked By":"Waiting On"}</label>
                <Inp value={form.waitingOn||""} onChange={e=>set("waitingOn",e.target.value||null)} placeholder="Who / what / dependency..."/>
              </div>
            )}
            <div><label className={lc} style={{color:C.muted}}>Description</label>
              <Txt value={form.description} onChange={e=>set("description",e.target.value)} rows={4} placeholder="Context, acceptance criteria..."/>
            </div>
            <div>
              <label className={lc} style={{color:C.muted}}>Tags</label>
              <div className="flex gap-1 flex-wrap mb-2">
                {form.tags.map(t=>(
                  <span key={t} className="inline-flex items-center gap-1 px-1.5 text-sm"
                    style={{backgroundColor:C.nested,border:`1px solid ${C.border}`,color:C.muted}}>
                    #{t}
                    <button onClick={()=>setForm(f=>({...f,tags:f.tags.filter(x=>x!==t)}))} style={{color:C.red}}><X size={8}/></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Inp value={tagI} onChange={e=>setTagI(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} placeholder="tag (Enter)" className="flex-1"/>
                <Btn v="secondary" sz="sm" onClick={addTag}><Plus size={10}/></Btn>
              </div>
            </div>
          </AccS>

          <AccS value="relations" title="RELATIONS" shape="◈">
            <p className="text-sm mb-2" style={{color:C.muted}}>Link quest (Parent · Blocks · Related · Duplicate · Caused By).</p>
            {["Parent","Blocks","Blocked by","Related","Duplicate"].map(r=>(
              <div key={r}><label className={lc} style={{color:C.muted}}>{r}</label><Inp placeholder="Search quests..."/></div>
            ))}
          </AccS>

          <AccS value="attachments" title="ATTACHMENTS & DELIVERABLES" shape="▶">
            <div>
              <label className={lc} style={{color:C.muted}}>Attachments</label>
              <Sel className="mb-2">
                <option value="">Add attachment type...</option>
                {["GitHub PR","GitHub Issue","Confluence","Figma","Slack","Discord","Google Docs","Google Drive","Meeting Recording","Website","Other"].map(a=><option key={a} value={a}>{a}</option>)}
              </Sel>
              {form.attachments.length===0&&<p className="text-sm" style={{color:C.dim}}>No attachments yet.</p>}
            </div>
            <div>
              <label className={lc} style={{color:C.muted}}>Deliverables</label>
              <Sel>
                <option value="">Add deliverable type...</option>
                {["PR","Confluence Page","Presentation","Meeting Notes","Design","Video","PDF","Research Doc"].map(d=><option key={d} value={d}>{d}</option>)}
              </Sel>
            </div>
          </AccS>

          <AccS value="chronicle" title="CHRONICLE" shape="◫">
            {!task?<p className="text-sm" style={{color:C.dim}}>History appears after creation.</p>:
              <div className="space-y-3">
                {[
                  {date:task.createdAt,text:"Quest created",color:C.muted},
                  {date:task.createdAt,text:`Priority: ${PRIORITY_CFG[task.priority].label}`,color:PRIORITY_CFG[task.priority].color},
                  {date:task.createdAt,text:`Status: ${STATUS_CFG[task.status].label}`,color:STATUS_CFG[task.status].color},
                  ...(task.completedAt?[{date:task.completedAt,text:"Quest completed! XP awarded.",color:C.green}]:[]),
                ].reverse().map((e,i)=>(
                  <div key={i} className="flex gap-3 pb-3" style={{borderBottom:`1px solid ${C.border}`}}>
                    <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{backgroundColor:e.color}}/>
                    <div>
                      <div className="text-sm" style={{color:e.color}}>{e.text}</div>
                      <div className="text-sm mt-0.5" style={{color:C.dim}}>{fmtDate(e.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </AccS>
        </Accordion.Root>
      </div>

      <div className="p-4 flex items-center justify-between" style={{borderTop:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <Btn v="ghost" sz="sm" onClick={onClose}>Cancel</Btn>
        <Btn v="primary" sz="md" onClick={()=>onSave(form)} disabled={!form.title.trim()}>
          <Check size={12}/>{isCreating?"Create Quest":"Save Changes"}
        </Btn>
      </div>
    </div>
  );
}

// ─── COMMAND PALETTE ──────────────────────────────────────────
type CI={label:string;sub?:string;shape:string;action:()=>void};
function CommandPalette({tasks,onClose,onNavigate,onTaskClick,onNewTask}:{tasks:Task[];onClose:()=>void;onNavigate:(s:Screen)=>void;onTaskClick:(t:Task)=>void;onNewTask:()=>void;}){
  const[q,setQ]=useState("");const[sel,setSel]=useState(0);
  const ir=useRef<HTMLInputElement>(null);
  useEffect(()=>{ir.current?.focus();},[]);
  const navI:CI[]=[...NAV_CORE,{id:"tasks" as Screen,label:"Tasks"},...NAV_SMART,...NAV_MANAGE,{id:"character" as Screen,label:"Character Sheet",icon:Swords}].map(n=>({label:n.label,sub:"Navigate",shape:"→",action:()=>{onNavigate(n.id);onClose();}}));
  const taskI:CI[]=tasks.filter(t=>t.status!=="archived").filter(t=>!q||t.title.toLowerCase().includes(q.toLowerCase())||t.tags.some(g=>g.includes(q.toLowerCase()))).slice(0,8).map(t=>({label:t.title,sub:`${STATUS_CFG[t.status].shape} ${STATUS_CFG[t.status].label} · ${t.project}`,shape:PRIORITY_CFG[t.priority].shape,action:()=>{onTaskClick(t);onClose();}}));
  const actI:CI[]=[{label:"New Quest",sub:"Create a task",shape:"+",action:()=>{onNewTask();onClose();}}];
  const all=q?[...taskI,...navI.filter(n=>n.label.toLowerCase().includes(q.toLowerCase())),...actI]:[...actI,...navI,...taskI.slice(0,5)];
  useEffect(()=>{setSel(0);},[q]);
  const hk=(e:React.KeyboardEvent)=>{
    if(e.key==="ArrowDown"){e.preventDefault();setSel(s=>Math.min(s+1,all.length-1));}
    else if(e.key==="ArrowUp"){e.preventDefault();setSel(s=>Math.max(s-1,0));}
    else if(e.key==="Enter"){e.preventDefault();all[sel]?.action();}
    else if(e.key==="Escape"){onClose();}
  };
  return(
    <div style={{backgroundColor:C.panel,border:`2px solid ${C.gold}`,boxShadow:`8px 8px 0 ${C.bg}`}}>
      <div className="flex items-center gap-3 px-4 py-3" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <Search size={14} style={{color:C.muted,flexShrink:0}}/>
        <input ref={ir} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={hk}
          placeholder="Search quests, navigate, or take action..."
          className="flex-1 bg-transparent text-sm font-['VT323'] outline-none" style={{color:C.text}}/>
        <kbd className="text-sm px-1.5 font-['VT323']" style={{color:C.muted,border:`1px solid ${C.border}`}}>ESC</kbd>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {all.length===0?<div className="text-center py-10 text-sm" style={{color:C.muted}}>[ NO RESULTS FOR "{q}" ]</div>:
          all.map((item,i)=>(
            <div key={i} onClick={item.action} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
              style={{backgroundColor:i===sel?C.nested:"transparent",borderLeft:i===sel?`2px solid ${C.gold}`:"2px solid transparent"}}>
              <span className="text-sm flex-shrink-0 w-4" style={{color:C.gold}}>{item.shape}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{color:C.text}}>{item.label}</div>
                {item.sub&&<div className="text-sm" style={{color:C.muted}}>{item.sub}</div>}
              </div>
            </div>
          ))
        }
      </div>
      <div className="px-4 py-2 flex gap-4 text-sm font-['VT323']" style={{borderTop:`1px solid ${C.border}`,backgroundColor:C.nested,color:C.dim}}>
        <span>↑↓ Navigate</span><span>↵ Select</span><span>Esc Close</span>
      </div>
    </div>
  );
}

// ─── SKILL TYPE CONFIG ────────────────────────────────────────
const SKILL_META: Record<TaskType,{title:string;desc:string;statName:string;color:string}> = {
  coding:        {title:"Coder",        desc:"Writing and shipping functional code",           statName:"INT",color:C.teal},
  investigation: {title:"Investigator", desc:"Diagnosing and tracing down root causes",        statName:"WIS",color:C.cyan},
  study:         {title:"Scholar",      desc:"Learning, reading, and absorbing knowledge",     statName:"INT",color:C.violet},
  analysis:      {title:"Analyst",      desc:"Breaking down data and complex systems",         statName:"WIS",color:C.yellow},
  documentation: {title:"Chronicler",  desc:"Capturing knowledge and writing clear docs",     statName:"CHA",color:C.muted},
  bug:           {title:"Bug Slayer",   desc:"Hunting and eliminating defects",                statName:"STR",color:C.red},
  deployment:    {title:"Deployer",     desc:"Shipping to production reliably",                statName:"DEX",color:C.green},
  testing:       {title:"Tester",       desc:"Ensuring quality through systematic checks",     statName:"WIS",color:C.cyan},
  meeting:       {title:"Diplomat",     desc:"Communicating and aligning with others",         statName:"CHA",color:C.violet},
  research:      {title:"Explorer",     desc:"Discovering new ideas and possibilities",        statName:"WIS",color:C.teal},
  design:        {title:"Artisan",      desc:"Crafting interfaces and visual experiences",     statName:"CHA",color:C.flame},
  maintenance:   {title:"Keeper",       desc:"Maintaining and improving existing systems",     statName:"CON",color:C.muted},
  refactor:      {title:"Refiner",      desc:"Improving code without changing behavior",       statName:"INT",color:C.gold},
  incident:      {title:"Firefighter",  desc:"Responding fast under pressure",                 statName:"STR",color:C.red},
  communication: {title:"Herald",       desc:"Keeping stakeholders informed and aligned",      statName:"CHA",color:C.violet},
};

function CharacterSheetView({tasks,xp,streak,coins}:{tasks:Task[];xp:number;streak:number;coins:number}){
  const done=useMemo(()=>tasks.filter(t=>t.status==="done"),[tasks]);

  // Compute per-type XP from completed tasks
  const typeXP = useMemo(()=>{
    const acc: Record<string,number>={};
    for(const t of done){
      const earned=calcXP(t.priority,t.storyPoints,true);
      acc[t.type]=(acc[t.type]||0)+earned;
    }
    return acc;
  },[done]);

  const {level:globalLevel}=getLevelInfo(xp);

  // Aggregate stat scores (D&D-like 1–20 scale, derived from skill levels)
  const STATS=["STR","DEX","CON","INT","WIS","CHA"] as const;
  const statScore: Record<string,number>={STR:8,DEX:8,CON:8,INT:8,WIS:8,CHA:8};
  for(const [type,meta] of Object.entries(SKILL_META)){
    const {level}=getLevelInfo(typeXP[type]||0);
    statScore[meta.statName]=Math.min(20,(statScore[meta.statName]||8)+Math.floor(level*0.6));
  }

  const skills=(Object.keys(TYPE_CFG) as TaskType[]).map(type=>{
    const count=done.filter(t=>t.type===type).length;
    const skillXp=typeXP[type]||0;
    const {level,currentXP,nextLevelXP}=getLevelInfo(skillXp);
    const meta=SKILL_META[type];
    const cfg=TYPE_CFG[type];
    return{type,count,skillXp,level,currentXP,nextLevelXP,meta,cfg};
  }).sort((a,b)=>b.skillXp-a.skillXp);

  const topSkill=skills[0];
  const classTitle=topSkill&&topSkill.level>1?SKILL_META[topSkill.type].title:"Apprentice";

  return(
    <div className="flex flex-col h-full">
      <div className="px-6 py-3" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:"11px",color:C.gold}}>⚔ CHARACTER SHEET</h1>
      </div>
      <div className="flex-1 overflow-y-auto">

        {/* Hero identity strip */}
        <div className="p-6" style={{background:`linear-gradient(135deg,${C.nested} 0%,${C.bg} 100%)`,borderBottom:`1px solid ${C.border}`}}>
          <div className="flex gap-6 items-start">
            {/* Avatar */}
            <div className="flex-shrink-0 relative">
              <div style={{
                width:88,height:88,
                backgroundColor:C.panel,
                border:`3px solid ${C.gold}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:"44px",
                boxShadow:`0 0 24px ${C.gold}30,inset 0 0 12px ${C.bg}`,
              }}>🧙</div>
              <div style={{
                position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",
                fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
                color:C.bg,backgroundColor:C.gold,padding:"2px 6px",whiteSpace:"nowrap",
              }}>LV.{globalLevel}</div>
            </div>
            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"14px",color:C.text,marginBottom:4}}>Aric Stormcloak</div>
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"9px",color:C.gold,marginBottom:12}}>{classTitle.toUpperCase()}</div>
              <div className="flex gap-4 flex-wrap text-sm" style={{color:C.muted}}>
                <span style={{color:C.xpGold}}>⚡ {xp.toLocaleString()} XP</span>
                <span style={{color:C.coin}}>🪙 {coins}</span>
                <span style={{color:C.flame}}>🔥 {streak} day streak</span>
                <span style={{color:C.teal}}>✓ {done.length} quests</span>
              </div>
            </div>
            {/* D&D stats */}
            <div className="flex-shrink-0">
              <div className="grid grid-cols-3 gap-2">
                {STATS.map(stat=>(
                  <div key={stat} className="text-center" style={{
                    backgroundColor:C.nested,border:`1px solid ${C.border}`,
                    padding:"6px 10px",minWidth:52,
                  }}>
                    <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"13px",color:C.text}}>{statScore[stat]}</div>
                    <div className="text-sm mt-1" style={{color:C.muted,letterSpacing:"1px"}}>{stat}</div>
                    <div className="text-sm" style={{color:C.dim}}>+{Math.floor((statScore[stat]-10)/2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Skill tree grid */}
        <div className="p-6">
          <div className="text-sm tracking-widest mb-4" style={{color:C.teal,fontFamily:"'Press Start 2P',monospace",fontSize:"9px"}}>▸ SKILL PROFICIENCIES</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {skills.map(({type,count,level,currentXP,nextLevelXP,meta,cfg})=>{
              const pct=nextLevelXP>0?Math.min(1,currentXP/nextLevelXP):1;
              const isEmpty=count===0;
              return(
                <div key={type}
                  style={{
                    backgroundColor:C.panel,
                    border:`2px solid ${isEmpty?C.border:meta.color}`,
                    borderLeftWidth:"4px",
                    opacity:isEmpty?0.45:1,
                    padding:"14px",
                    position:"relative",
                    transition:"opacity 0.2s",
                  }}>
                  {/* level badge */}
                  <div style={{
                    position:"absolute",top:10,right:10,
                    fontFamily:"'Press Start 2P',monospace",fontSize:"9px",
                    color:isEmpty?C.dim:meta.color,
                    border:`1px solid ${isEmpty?C.border:meta.color}`,
                    padding:"2px 6px",
                  }}>LV.{level}</div>

                  {/* header */}
                  <div className="flex items-center gap-2 mb-2" style={{marginRight:52}}>
                    <span style={{fontSize:"20px"}}>{cfg.emoji}</span>
                    <div>
                      <div className="text-sm font-bold" style={{color:isEmpty?C.dim:C.text}}>{cfg.label}</div>
                      <div className="text-sm" style={{color:meta.color,fontFamily:"'Press Start 2P',monospace",fontSize:"7px"}}>{meta.title.toUpperCase()}</div>
                    </div>
                  </div>

                  {/* description */}
                  <div className="text-sm mb-3" style={{color:C.dim,lineHeight:"1.4"}}>{meta.desc}</div>

                  {/* XP bar */}
                  <div className="mb-1" style={{height:6,backgroundColor:C.nested,border:`1px solid ${C.border}`}}>
                    <div style={{width:`${pct*100}%`,height:"100%",backgroundColor:isEmpty?C.dim:meta.color,transition:"width 0.6s ease"}}/>
                  </div>
                  <div className="flex justify-between text-sm" style={{color:C.dim}}>
                    <span>{isEmpty?"No quests yet":`${count} quest${count!==1?"s":""} completed`}</span>
                    {!isEmpty&&<span>{currentXP}/{nextLevelXP} XP</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────
function LoginScreen({onLogin}:{onLogin:()=>void}){
  const[hovG,setHovG]=useState(false);
  const[hovD,setHovD]=useState(false);
  return(
    <div className="h-screen flex flex-col items-center justify-center" style={{backgroundColor:C.bg,backgroundImage:`radial-gradient(ellipse at 50% 30%, ${C.gold}08 0%, transparent 60%)`}}>
      <style>{`
        @keyframes torchFlicker{0%,100%{opacity:1}33%{opacity:0.75}66%{opacity:0.9}}
        @keyframes loginSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{animation:"loginSlideUp 0.5s ease forwards",textAlign:"center",maxWidth:"420px",width:"100%",padding:"0 24px"}}>
        {/* torches */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <span style={{fontSize:"28px",animation:"torchFlicker 1.2s ease-in-out infinite"}}>🔥</span>
          <div>
            <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"22px",color:C.gold,textShadow:`0 0 30px ${C.gold}60`,letterSpacing:"4px"}}>ATLAS</div>
            <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:"8px",color:C.muted,marginTop:"8px",letterSpacing:"2px"}}>YOUR SECOND BRAIN</div>
          </div>
          <span style={{fontSize:"28px",animation:"torchFlicker 1.2s ease-in-out infinite",animationDelay:"0.4s"}}>🔥</span>
        </div>

        {/* hero pixel char */}
        <div style={{fontSize:"56px",animation:"pixelPulse 3s ease-in-out infinite",marginBottom:"32px"}}>🧙</div>

        <p style={{fontFamily:"VT323,monospace",fontSize:"18px",color:C.muted,marginBottom:"40px",lineHeight:"1.6"}}>
          Track quests. Earn XP. Level up your life.
        </p>

        {/* Google sign in */}
        <button
          onClick={onLogin}
          onMouseEnter={()=>setHovG(true)}
          onMouseLeave={()=>setHovG(false)}
          style={{
            width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:"12px",
            padding:"14px 24px",marginBottom:"12px",cursor:"pointer",
            backgroundColor:hovG?C.panel:"#fff",
            border:`2px solid ${hovG?C.gold:C.border}`,
            transition:"all 0.15s",
            boxShadow:hovG?`0 0 16px ${C.gold}30`:"none",
          }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span style={{fontFamily:"VT323,monospace",fontSize:"18px",color:hovG?C.text:"#333",letterSpacing:"1px"}}>
            Sign in with Google
          </span>
        </button>

        {/* guest */}
        <button
          onClick={onLogin}
          onMouseEnter={()=>setHovD(true)}
          onMouseLeave={()=>setHovD(false)}
          style={{
            width:"100%",padding:"12px 24px",cursor:"pointer",
            backgroundColor:"transparent",
            border:`2px solid ${hovD?C.teal:C.border}`,
            color:hovD?C.teal:C.muted,
            fontFamily:"VT323,monospace",fontSize:"16px",letterSpacing:"2px",
            transition:"all 0.15s",
          }}>
          ◇ CONTINUE AS GUEST (DEMO MODE)
        </button>

        <p style={{fontFamily:"VT323,monospace",fontSize:"13px",color:C.dim,marginTop:"28px"}}>
          No real auth — demo only · Your data stays local
        </p>
      </div>
    </div>
  );
}

// ─── NEW PROJECT PANEL ────────────────────────────────────────
const PROJECT_COLORS=[
  {label:"Red",    value:"#e94560"},
  {label:"Violet", value:"#a29bfe"},
  {label:"Teal",   value:"#4ecca3"},
  {label:"Yellow", value:"#f6c90e"},
  {label:"Cyan",   value:"#00b8d9"},
  {label:"Muted",  value:"#6b7483"},
];
const PROJECT_CATEGORIES=["Full-time","University","Side Project","Freelance","Personal","Other"];
function NewProjectPanel({onClose,onSave}:{onClose:()=>void;onSave:(p:Project)=>void}){
  const[name,setName]=useState("");
  const[emoji,setEmoji]=useState("🚀");
  const[category,setCategory]=useState("Side Project");
  const[color,setColor]=useState(C.teal);
  const[description,setDescription]=useState("");
  const[status,setStatus]=useState<Project["status"]>("active");
  const lc="block text-sm tracking-widest uppercase mb-1";
  function handleSave(){
    if(!name.trim())return;
    onSave({id:`p${Date.now()}`,name:name.trim(),emoji,category,color,description,status,totalTasks:0,completedTasks:0});
  }
  return(
    <div className="flex flex-col h-full" style={{backgroundColor:C.panel}}>
      <div className="px-4 py-3 flex items-center justify-between" style={{borderBottom:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:"9px",color:C.gold}}>+ NEW PROJECT</span>
        <button onClick={onClose} className="p-1 transition-colors" style={{color:C.muted}}
          onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.muted)}>
          <X size={15}/>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* preview strip */}
        <div className="flex items-center gap-3 p-3" style={{backgroundColor:C.nested,border:`2px solid ${color}`,borderLeftWidth:"4px"}}>
          <span style={{fontSize:"24px"}}>{emoji||"🚀"}</span>
          <div>
            <div className="text-sm font-bold" style={{color:C.text}}>{name||"Project Name"}</div>
            <div className="text-sm" style={{color:C.muted}}>{category}</div>
          </div>
        </div>
        <div>
          <label className={lc} style={{color:C.muted}}>Project Name *</label>
          <Inp value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. My New Project"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lc} style={{color:C.muted}}>Emoji</label>
            <Inp value={emoji} onChange={e=>setEmoji(e.target.value.slice(-2)||"🚀")} placeholder="🚀" style={{fontSize:"20px"}}/>
          </div>
          <div>
            <label className={lc} style={{color:C.muted}}>Category</label>
            <Sel value={category} onChange={e=>setCategory(e.target.value)}>
              {PROJECT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </Sel>
          </div>
        </div>
        <div>
          <label className={lc} style={{color:C.muted}}>Color</label>
          <div className="flex gap-2 flex-wrap mt-1">
            {PROJECT_COLORS.map(pc=>(
              <button key={pc.value} onClick={()=>setColor(pc.value)} title={pc.label}
                style={{width:"28px",height:"28px",backgroundColor:pc.value,border:color===pc.value?`3px solid ${C.text}`:`3px solid transparent`,transition:"border 0.1s"}}/>
            ))}
          </div>
        </div>
        <div>
          <label className={lc} style={{color:C.muted}}>Status</label>
          <Sel value={status} onChange={e=>setStatus(e.target.value as Project["status"])}>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
          </Sel>
        </div>
        <div>
          <label className={lc} style={{color:C.muted}}>Description</label>
          <Txt value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="What is this project about?"/>
        </div>
      </div>
      <div className="p-4 flex items-center justify-between" style={{borderTop:`1px solid ${C.border}`,backgroundColor:C.nested}}>
        <Btn v="ghost" sz="sm" onClick={onClose}>Cancel</Btn>
        <Btn v="primary" sz="md" onClick={handleSave} disabled={!name.trim()}>
          <Check size={12}/> Create Project
        </Btn>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App(){
  const[isLoggedIn,setIsLoggedIn]=useState(false);
  const[screen,setScreen]=useState<Screen>("dashboard");
  const[tasks,setTasks]=useState<Task[]>(INITIAL_TASKS);
  const[projects,setProjects]=useState<Project[]>(INITIAL_PROJECTS);
  const[selectedTask,setSelectedTask]=useState<Task|null>(null);
  const[isPanelOpen,setIsPanelOpen]=useState(false);
  const[isCreating,setIsCreating]=useState(false);
  const[isProjectPanelOpen,setIsProjectPanelOpen]=useState(false);
  const[isCmdOpen,setIsCmdOpen]=useState(false);
  const[earnedXP,setEarnedXP]=useState(0);
  const[earnedCoins,setEarnedCoins]=useState(0);
  const[streak]=useState(MOCK_STREAK);
  const[notifs,setNotifs]=useState<GameNotif[]>([]);
  const[dailyQuestClaimed,setDailyQuestClaimed]=useState(false);
  const[companionExcited,setCompanionExcited]=useState(false);
  const earnedXPRef=useRef(0);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(!isLoggedIn)return;
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();setIsCmdOpen(o=>!o);}
      if((e.ctrlKey||e.metaKey)&&e.key==="n"){e.preventDefault();openCreate();}
      if(e.key==="Escape"){setIsCmdOpen(false);setIsPanelOpen(false);}
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[isLoggedIn]);

  if(!isLoggedIn)return<LoginScreen onLogin={()=>setIsLoggedIn(true)}/>;

  const xp=MOCK_XP+earnedXP;
  const coins=MOCK_COINS+earnedCoins;

  function pushNotif(n:Omit<GameNotif,"id">){
    const id=`n${Date.now()}${Math.random()}`;
    setNotifs(prev=>[...prev,{...n,id}]);
    setTimeout(()=>setNotifs(prev=>prev.filter(x=>x.id!==id)),4000);
  }
  function dismissNotif(id:string){setNotifs(prev=>prev.filter(x=>x.id!==id));}

  function openTask(t:Task){setSelectedTask(t);setIsCreating(false);setIsPanelOpen(true);}
  function openCreate(){setSelectedTask(null);setIsCreating(true);setIsPanelOpen(true);}
  function saveTask(t:Task){
    const today=new Date().toISOString().slice(0,10);
    const existing=tasks.find(x=>x.id===t.id);
    const justCompleted=t.status==="done"&&existing?.status!=="done";
    const updatedTask=justCompleted?{...t,completedAt:today}:t;
    setTasks(prev=>existing?prev.map(x=>x.id===t.id?updatedTask:x):[updatedTask,...prev]);
    if(justCompleted){
      const xpEarned=calcXP(t.priority,t.storyPoints,!isOverdue(t.dueDate));
      const coinsEarned=calcCoins(t.priority,t.storyPoints);
      const oldLevel=getLevelInfo(MOCK_XP+earnedXPRef.current).level;
      const newLevel=getLevelInfo(MOCK_XP+earnedXPRef.current+xpEarned).level;
      earnedXPRef.current+=xpEarned;
      setEarnedXP(earnedXPRef.current);
      setEarnedCoins(c=>c+coinsEarned);
      pushNotif({type:"xp",title:`+${xpEarned} XP`,sub:`Quest complete! +${coinsEarned} 🪙`,icon:"⚡",color:C.xpGold});
      setCompanionExcited(true);setTimeout(()=>setCompanionExcited(false),1800);
      if(newLevel>oldLevel){
        setTimeout(()=>pushNotif({type:"levelup",title:`LEVEL UP → LV.${newLevel}`,sub:getLevelTitle(newLevel),icon:"🏆",color:C.gold}),900);
      }
    }
    setIsPanelOpen(false);
  }
  function claimDailyQuest(){
    if(dailyQuestClaimed)return;
    setDailyQuestClaimed(true);
    const xpBonus=TODAY_DAILY_QUEST.xp;
    const coinBonus=TODAY_DAILY_QUEST.coins;
    earnedXPRef.current+=xpBonus;
    setEarnedXP(earnedXPRef.current);
    setEarnedCoins(c=>c+coinBonus);
    pushNotif({type:"daily-quest",title:"DAILY QUEST COMPLETE!",sub:`+${xpBonus} XP  +${coinBonus} 🪙`,icon:"◆",color:C.teal});
  }

  const todayT=tasks.filter(t=>isDueToday(t.dueDate)&&t.status!=="done"&&t.status!=="archived");
  const waitingT=tasks.filter(t=>t.status==="waiting-external");
  const focusT=tasks.filter(t=>(t.priority==="p0"||t.priority==="p1")&&t.status==="ready");
  const inboxT=tasks.filter(t=>t.status==="inbox");

  function renderScreen(){
    switch(screen){
      case"dashboard":    return<DashboardView tasks={tasks} sprints={SPRINTS} onTaskClick={openTask} onNavigate={setScreen} xp={xp} streak={streak} coins={coins} dailyQuestClaimed={dailyQuestClaimed} onClaimDailyQuest={claimDailyQuest}/>;
      case"tasks":        return<TasksView tasks={tasks} onTaskClick={openTask} onNewTask={openCreate} projects={projects}/>;
      case"today":        return<FilteredView title="TODAY" color={C.gold} icon={Sun} desc="Quests due today and in progress" tasks={todayT} onTaskClick={openTask} onNewTask={openCreate} empty="[ ALL CLEAR ]"/>;
      case"inbox-view":   return<FilteredView title="INBOX" color={C.muted} icon={Inbox} desc="Captured but not yet triaged" tasks={inboxT} onTaskClick={openTask} onNewTask={openCreate} empty="[ INBOX EMPTY ]"/>;
      case"waiting":      return<FilteredView title="WAITING EXTERNAL" color={C.violet} icon={Clock} desc="Quests waiting on another person or system" tasks={waitingT} onTaskClick={openTask} empty="[ NOTHING WAITING ]"/>;
      case"focus":        return<FilteredView title="FOCUS MODE" color={C.teal} icon={Crosshair} desc="P0+P1 priority AND Ready status — work that matters most" tasks={focusT} onTaskClick={openTask} onNewTask={openCreate} empty="[ ALL DONE — REST ]"/>;
      case"projects":     return<ProjectsView tasks={tasks} projects={projects} onNewProject={()=>setIsProjectPanelOpen(true)}/>;
      case"sprints":      return<SprintsView sprints={SPRINTS} tasks={tasks}/>;
      case"achievements": return<AchievementsView achievements={ACHIEVEMENTS} tasks={tasks}/>;
      case"statistics":   return<StatisticsView tasks={tasks} projects={projects} xp={xp} streak={streak}/>;
      case"character":    return<CharacterSheetView tasks={tasks} xp={xp} streak={streak} coins={coins}/>;
      case"settings":     return<SettingsView/>;
      default:            return null;
    }
  }

  return(
    <div className="h-screen flex overflow-hidden font-['VT323']" style={{backgroundColor:C.bg,color:C.text}}>
    <style>{`
      @keyframes slideInRight{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
      @keyframes pixelPulse{0%,100%{opacity:1}50%{opacity:0.45}}
      @keyframes cmpBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes cmpBounceFast{0%,100%{transform:translateY(0) scaleX(1)}40%{transform:translateY(-9px) scaleX(0.9)}90%{transform:translateY(1px) scaleX(1.08)}}
      @keyframes cmpBreathe{0%,100%{transform:scaleY(1) scaleX(1)}50%{transform:scaleY(0.93) scaleX(1.04)}}
      @keyframes cmpSway{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
      @keyframes cmpSad{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
    `}</style>
      <Sidebar active={screen} onNavigate={setScreen} tasks={tasks} onNewTask={openCreate} onCmd={()=>setIsCmdOpen(true)} xp={xp} streak={streak} coins={coins} companionExcited={companionExcited}/>
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">{renderScreen()}</main>

      {isPanelOpen&&<div className="fixed inset-0 z-30 bg-black/65" onClick={()=>setIsPanelOpen(false)}/>}
      <div className="fixed top-0 right-0 bottom-0 z-40 w-[420px] flex flex-col transition-transform duration-200"
        style={{transform:isPanelOpen?"translateX(0)":"translateX(100%)",boxShadow:`-8px 0 40px rgba(0,0,0,0.75)`}}
        onClick={e=>e.stopPropagation()}>
        <TaskPanel task={selectedTask} isCreating={isCreating} onClose={()=>setIsPanelOpen(false)} onSave={saveTask}/>
      </div>

      {isProjectPanelOpen&&<div className="fixed inset-0 z-30 bg-black/65" onClick={()=>setIsProjectPanelOpen(false)}/>}
      <div className="fixed top-0 right-0 bottom-0 z-40 w-[400px] flex flex-col transition-transform duration-200"
        style={{transform:isProjectPanelOpen?"translateX(0)":"translateX(100%)",boxShadow:`-8px 0 40px rgba(0,0,0,0.75)`}}
        onClick={e=>e.stopPropagation()}>
        <NewProjectPanel onClose={()=>setIsProjectPanelOpen(false)} onSave={p=>{setProjects(prev=>[...prev,p]);setIsProjectPanelOpen(false);pushNotif({type:"xp",title:"Project Created!",sub:`${p.emoji} ${p.name}`,icon:"◈",color:C.teal});}}/>
      </div>

      <GameNotifStack notifs={notifs} onDismiss={dismissNotif}/>

      {isCmdOpen&&(
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/80" onClick={()=>setIsCmdOpen(false)}/>
          <div className="relative z-10 w-full max-w-xl">
            <CommandPalette tasks={tasks} onClose={()=>setIsCmdOpen(false)} onNavigate={setScreen} onTaskClick={t=>{openTask(t);setIsCmdOpen(false);}} onNewTask={openCreate}/>
          </div>
        </div>
      )}
    </div>
  );
}
