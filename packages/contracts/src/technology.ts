import { z } from 'zod';
import { TECHNOLOGY_CATEGORIES } from './enums';

export const detectedTechnologySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  category: z.enum(TECHNOLOGY_CATEGORIES),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});
export type DetectedTechnology = z.infer<typeof detectedTechnologySchema>;

export const projectTechnologyProfileSchema = z.object({
  primaryLanguage: z.string().nullable(),
  languages: z.array(detectedTechnologySchema),
  frameworks: z.array(detectedTechnologySchema),
  packageManagers: z.array(detectedTechnologySchema),
  buildTools: z.array(detectedTechnologySchema),
  testTools: z.array(detectedTechnologySchema),
  infrastructureTools: z.array(detectedTechnologySchema),
  detectedAt: z.string(),
});
export type ProjectTechnologyProfile = z.infer<typeof projectTechnologyProfileSchema>;
