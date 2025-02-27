import { z } from 'zod'
import { StatusSchema } from './shared.schema'

const CommonUrlLoaderSchema = z.object({
  url: z.string().url().describe('The URL to load data from.'),
})

export const LoaderTypeSchema = z.enum([
  'text',
  'youtube',
  'youtube_channel',
  'youtube_search',
  'web',
  'sitemap',
  'pdf',
  'docx',
  'excel',
  'ppt',
  // 'confluence',
  // 'json',
])

export const TextLoaderSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

export const YoutubeLoaderSchema = z.object({
  type: z.literal('youtube'),
  videoIdOrUrl: z.string(),
})

export const YoutubeChannelLoaderSchema = z.object({
  type: z.literal('youtube_channel'),
  youtubeChannelId: z.string(),
})

export const YoutubeSearchLoaderSchema = z.object({
  type: z.literal('youtube_search'),
  youtubeSearchString: z.string(),
})

export const WebLoaderSchema = z.object({
  type: z.literal('web'),
  urlOrContent: z.string(),
})

export const SitemapLoaderSchema = CommonUrlLoaderSchema.extend({
  type: z.literal('sitemap'),
})

export const PdfLoaderSchema = z.object({
  type: z.literal('pdf'),
  filePathOrUrl: z.string(),
})

export const DocxLoaderSchema = z.object({
  type: z.literal('docx'),
  filePathOrUrl: z.string(),
})

export const ExcelLoaderSchema = z.object({
  type: z.literal('excel'),
  filePathOrUrl: z.string(),
})
export const PptLoaderSchema = z.object({
  type: z.literal('ppt'),
  filePathOrUrl: z.string(),
})
// export const ConfluenceLoaderSchema = z.object({
//   type: z.literal('confluence'),
//   spaceNames: z.array(z.string()),
// })

// export const JsonLoaderSchema = z.object({
//   type: z.literal('json'),
//   object: z.record(z.any()),
//   pickKeysForEmbedding: z.array(z.string()),
// })

export const LoaderWithoutConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().optional(),
  packId: z.string().uuid(),
  type: LoaderTypeSchema,
  status: StatusSchema,
  isUpload: z.boolean().optional(),
  path: z.string().optional(),
})

export const LoaderConfigSchema = z.discriminatedUnion('type', [
  TextLoaderSchema,
  YoutubeLoaderSchema,
  YoutubeChannelLoaderSchema,
  YoutubeSearchLoaderSchema,
  WebLoaderSchema,
  SitemapLoaderSchema,
  PdfLoaderSchema,
  DocxLoaderSchema,
  ExcelLoaderSchema,
  PptLoaderSchema,
])

export const LoaderSchema = LoaderWithoutConfigSchema.extend({
  config: LoaderConfigSchema,
})

export const AddLoaderSchema = LoaderSchema.omit({
  id: true,
  packId: true,
  status: true,
})

export const AddLoaderResponseSchema = z.object({
  status: StatusSchema,
  id: z.string().uuid(),
  jobId: z.string().uuid(),
})

export type Loader = z.infer<typeof LoaderSchema>

export type LoaderType = Loader['type']

export const loaderSchemaMap: Record<LoaderType, z.ZodObject<any>> = {
  text: TextLoaderSchema,
  youtube: YoutubeLoaderSchema,
  youtube_channel: YoutubeChannelLoaderSchema,
  youtube_search: YoutubeSearchLoaderSchema,
  web: WebLoaderSchema,
  sitemap: SitemapLoaderSchema,
  pdf: PdfLoaderSchema,
  docx: DocxLoaderSchema,
  excel: ExcelLoaderSchema,
  ppt: PptLoaderSchema,
  // confluence: ConfluenceLoaderSchema,
  // json: JsonLoaderSchema,
}

export const LoaderChunkSchema = z.any()

export const LoaderWithChunks = LoaderSchema.extend({
  chunks: z.array(LoaderChunkSchema),
})
