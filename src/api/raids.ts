import { supabase } from '../lib/supabase';
import type { MemberStatus, NewRaidGroup, NewRaidMember, RaidGroup, RaidMember } from '../types';

const db = supabase as any;

type RaidGroupRow = {
  id: string;
  title: string;
  boss: string;
  raid_date: string;
  raid_time: string;
  leader: string;
  min_level: number;
  capacity: number;
  status: RaidGroup['status'];
  notice: string;
  created_at: string;
  updated_at: string;
  raid_members?: RaidMemberRow[];
};

type RaidMemberRow = {
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

function mapMember(row: RaidMemberRow): RaidMember {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    job: row.job,
    level: row.level,
    role: row.role,
    party: row.party,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGroup(row: RaidGroupRow): RaidGroup {
  const members = [...(row.raid_members ?? [])]
    .sort((a, b) => a.party - b.party || a.created_at.localeCompare(b.created_at))
    .map(mapMember);

  return {
    id: row.id,
    title: row.title,
    boss: row.boss,
    raidDate: row.raid_date,
    raidTime: row.raid_time.slice(0, 5),
    leader: row.leader,
    minLevel: row.min_level,
    capacity: row.capacity,
    status: row.status,
    notice: row.notice,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members,
  };
}

export async function fetchRaidGroups(): Promise<RaidGroup[]> {
  const { data, error } = await db
    .from('raid_groups')
    .select('*, raid_members(*)')
    .order('raid_date', { ascending: true })
    .order('raid_time', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as RaidGroupRow[]).map(mapGroup);
}

export async function insertRaidGroup(group: NewRaidGroup): Promise<void> {
  const { error } = await db.from('raid_groups').insert({
    id: group.id,
    title: group.title,
    boss: group.boss,
    raid_date: group.raidDate,
    raid_time: group.raidTime,
    leader: group.leader,
    min_level: group.minLevel,
    capacity: group.capacity,
    status: group.status,
    notice: group.notice,
  });

  if (error) throw new Error(error.message);
}

export async function deleteRaidGroup(groupId: string): Promise<void> {
  const { error } = await db.from('raid_groups').delete().eq('id', groupId);
  if (error) throw new Error(error.message);
}

export async function insertRaidMember(member: NewRaidMember): Promise<void> {
  const { error } = await db.from('raid_members').insert({
    group_id: member.groupId,
    name: member.name,
    job: member.job,
    level: member.level,
    role: member.role,
    party: member.party,
    status: member.status,
    note: member.note,
  });

  if (error) throw new Error(error.message);
}

export async function updateRaidMemberStatus(memberId: string, status: MemberStatus): Promise<void> {
  const { error } = await db.from('raid_members').update({ status }).eq('id', memberId);
  if (error) throw new Error(error.message);
}

export async function deleteRaidMember(memberId: string): Promise<void> {
  const { error } = await db.from('raid_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);
}
