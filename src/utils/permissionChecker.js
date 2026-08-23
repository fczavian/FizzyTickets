import { PermissionFlagsBits } from 'discord.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { config } from '../config/config.js';

export async function isGuildAdmin(member) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

  const guildConfig = await GuildConfig.findOne({ guildId: member.guild.id }).lean();
  if (!guildConfig) return false;

  const adminRoles = guildConfig.adminRoleIds || [];
  return adminRoles.some((roleId) => member.roles.cache.has(roleId));
}

export async function isTicketStaff(member, categoryId = null) {
  if (!member) return false;
  if (await isGuildAdmin(member)) return true;

  const guildConfig = await GuildConfig.findOne({ guildId: member.guild.id }).lean();
  if (!guildConfig) return false;

  const globalSupportRoles = guildConfig.supportRoleIds || [];
  const hasGlobalRole = globalSupportRoles.some((roleId) => member.roles.cache.has(roleId));
  if (hasGlobalRole) return true;

  // Check per-category roles if enabled
  if (config.features.perCategoryRoles.enabled && categoryId) {
    const category = guildConfig.categories?.find((c) => c.id === categoryId);
    if (category && Array.isArray(category.supportRoleIds)) {
      const hasCategoryRole = category.supportRoleIds.some((roleId) => member.roles.cache.has(roleId));
      if (hasCategoryRole) return true;
    }
  }

  return false;
}

export async function canManageTicket(member, ticket) {
  if (!member || !ticket) return false;
  if (await isGuildAdmin(member)) return true;
  return await isTicketStaff(member, ticket.categoryId);
}
