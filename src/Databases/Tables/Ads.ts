import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import * as uuid from 'uuid';

export const AdsTable = sqliteTable("ads", {
  id: text("ad_id").primaryKey().$defaultFn(() => uuid.v4()), 
  type: text("type", { enum: ["small", "post"] }), 
  content: text("content"), 
  targetAge: text("target_age"), 
  targetGender: text("target_gender", { enum: ["men", "women", "any"] }), 
  targetTags: text("taret_interests"), 
  compaignType: text("campaign_type", { enum: ["views", "time"] }), 
  maxViews: integer("max_views").default(-1), 
  startDate: text("start_date").default(sql`(CURRENT_TIMESTAMP)`), 
  endDate: text("end_date").default(sql`(CURRENT_TIMESTAMP)`), 
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"), 
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"), 
});
