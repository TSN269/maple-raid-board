export type RaidStatus = 'open' | 'closed' | 'finished';
export type MemberStatus = '待確認' | '已確認' | '候補' | '請假';

export type RaidMember = {
  id: string;
  groupId: string;
  name: string;
  job: string;
  level: number;
  role: string;
  party: number;
  status: MemberStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type RaidGroup = {
  id: string;
  title: string;
  boss: string;
  raidDate: string;
  raidTime: string;
  leader: string;
  minLevel: number;
  capacity: number;
  status: RaidStatus;
  notice: string;
  createdAt: string;
  updatedAt: string;
  members: RaidMember[];
};

export type NewRaidGroup = {
  id: string;
  title: string;
  boss: string;
  raidDate: string;
  raidTime: string;
  leader: string;
  minLevel: number;
  capacity: number;
  status: RaidStatus;
  notice: string;
};

export type NewRaidMember = {
  groupId: string;
  name: string;
  job: string;
  level: number;
  role: string;
  party: number;
  status: MemberStatus;
  note: string;
};

type RaidGroupsRow = {
  id: string;
  title: string;
  boss: string;
  raid_date: string;
  raid_time: string;
  leader: string;
  min_level: number;
  capacity: number;
  status: RaidStatus;
  notice: string;
  created_at: string;
  updated_at: string;
};

type RaidGroupsInsert = {
  id: string;
  title: string;
  boss: string;
  raid_date: string;
  raid_time: string;
  leader: string;
  min_level?: number;
  capacity?: number;
  status?: RaidStatus;
  notice?: string;
  created_at?: string;
  updated_at?: string;
};

type RaidMembersRow = {
  id: string;
  group_id: string;
  name: string;
  job: string;
  level: number;
  role: string;
  party: number;
  status: MemberStatus;
  note: string;
  created_at: string;
  updated_at: string;
};

type RaidMembersInsert = {
  id?: string;
  group_id: string;
  name: string;
  job: string;
  level: number;
  role: string;
  party?: number;
  status?: MemberStatus;
  note?: string;
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      raid_groups: {
        Row: RaidGroupsRow;
        Insert: RaidGroupsInsert;
        Update: Partial<RaidGroupsInsert>;
      };
      raid_members: {
        Row: RaidMembersRow;
        Insert: RaidMembersInsert;
        Update: Partial<RaidMembersInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
