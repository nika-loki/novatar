/**
 * Avatars engine — adapted from SpaceUI (MIT).
 * 21 generative variants across 4 families: gradient, fluid, classic, paletteless.
 */
export {
  createAvatar,
  resolveVariant,
  type AvatarColors,
  type AvatarJson,
  type CreateAvatarOptions,
} from './core/create-avatar'
export {
  ALL_AVATAR_VARIANTS,
  AvatarEffect,
  AvatarFamily,
  AvatarOutputFormat,
  AvatarVariant,
  DEFAULT_AVATAR_VARIANT,
  getAllAvatarDetails,
  getAvatarDetails,
  getFamilyVariants,
  isAnimateActive,
} from './types/avatar'
export type { AvatarDetails } from './types/avatar'
