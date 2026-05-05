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
    party: Math.min(3, Math.max(1, Number(row.party || 1))),
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
    capacity: Math.min(18, Math.max(1, Number(row.capacity || 18))),
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
  const { error } = await db.rpc('create_raid_group_with_code', {
    p_id: group.id,
    p_title: group.title,
    p_boss: group.boss,
    p_raid_date: group.raidDate,
    p_raid_time: group.raidTime,
    p_leader: group.leader,
    p_min_level: group.minLevel,
    p_capacity: Math.min(18, Math.max(1, Number(group.capacity || 18))),
    p_status: group.status,
    p_notice: group.notice,
    p_leader_code: group.leaderCode,
  });

  if (error) throw new Error(error.message);
}

export async function verifyLeaderCode(groupId: string, leaderCode: string): Promise<boolean> {
  const { data, error } = await db.rpc('verify_raid_leader_code', {
    p_group_id: groupId,
    p_leader_code: leaderCode,
  });

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function deleteRaidGroup(groupId: string, leaderCode: string): Promise<void> {
  const { error } = await db.rpc('delete_raid_group_with_code', {
    p_group_id: groupId,
    p_leader_code: leaderCode,
  });
  if (error) throw new Error(error.message);
}

export async function insertRaidMember(member: NewRaidMember): Promise<void> {
  const { error } = await db.from('raid_members').insert({
    group_id: member.groupId,
    name: member.name,
    job: member.job,
    level: member.level,
    role: member.role,
    party: Math.min(3, Math.max(1, Number(member.party || 1))),
    status: '待確認',
    note: member.note,
  });

  if (error) throw new Error(error.message);
}

export async function updateRaidMemberStatus(memberId: string, status: MemberStatus, leaderCode: string): Promise<void> {
  const { error } = await db.rpc('update_raid_member_status_with_code', {
    p_member_id: memberId,
    p_status: status,
    p_leader_code: leaderCode,
  });
  if (error) throw new Error(error.message);
}

export async function deleteRaidMember(memberId: string, leaderCode: string): Promise<void> {
  const { error } = await db.rpc('delete_raid_member_with_code', {
    p_member_id: memberId,
    p_leader_code: leaderCode,
  });
  if (error) throw new Error(error.message);
}

export async function updateRaidGroupStatus(groupId: string, status: RaidGroup['status'], leaderCode: string): Promise<void> {
  const { error } = await db.rpc('update_raid_group_status_with_code', {
    p_group_id: groupId,
    p_status: status,
    p_leader_code: leaderCode,
  });
  if (error) throw new Error(error.message);
}
