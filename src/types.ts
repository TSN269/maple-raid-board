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
  leaderCode: string;
  signupCode: string;
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
  signupCode: string;
  clientNonce: string;
  honeypot?: string;
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
        Relationships: [];
      };
      raid_members: {
        Row: RaidMembersRow;
        Insert: RaidMembersInsert;
        Update: Partial<RaidMembersInsert>;
        Relationships: [
          {
            foreignKeyName: 'raid_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'raid_groups';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
