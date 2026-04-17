import User from "../models/User.js";
import Bookmark from "../models/BookMark.js";
import Question from "../models/Question.js";
import StructuredQuestion from "../models/StructuredQuestion.js";

const DEFAULT_CACHE_TTL_MS = 15000;

const cache = new Map();

const getCache = (key) => {
  const item = cache.get(key);
  if (!item) return undefined;
  if (item.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return item.value;
};

const setCache = (key, value, ttlMs = DEFAULT_CACHE_TTL_MS) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const parseCacheTtlMs = () => {
  const raw = process.env.ADMIN_STATS_CACHE_TTL_MS;
  if (!raw) return DEFAULT_CACHE_TTL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_CACHE_TTL_MS;
  return n;
};

const toDayString = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
};

const toMonthString = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 7);
};

const utcStartOfDay = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));

const utcStartOfMonth = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));

const aggregateDailyCounts = async (model, match = {}) => {
  const rows = await model.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      }
    }
  ]);
  const map = new Map();
  for (const r of rows) map.set(r._id, Number(r.count) || 0);
  return map;
};

const aggregateMonthlyCounts = async (model, match = {}) => {
  const rows = await model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" }
        },
        count: { $sum: 1 }
      }
    }
  ]);
  const map = new Map();
  for (const r of rows) map.set(r._id, Number(r.count) || 0);
  return map;
};

const aggregateMonthlyPaperCounts = async (match = {}) => {
  const rows = await StructuredQuestion.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
          year: "$year",
          part: "$part",
          paper: "$paper"
        }
      }
    },
    { $group: { _id: "$_id.month", count: { $sum: 1 } } }
  ]);
  const map = new Map();
  for (const r of rows) map.set(r._id, Number(r.count) || 0);
  return map;
};

export const getAdminStats = async (req, res) => {
  const cacheKey = "admin:stats:totals";
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const ttlMs = parseCacheTtlMs();

  const [users, structuredQuestions, legacyQuestions, papersAgg, bookmarks] = await Promise.all([
    User.countDocuments({ isDeleted: false, isActive: true }),
    StructuredQuestion.countDocuments({}),
    Question.countDocuments({}),
    StructuredQuestion.aggregate([
      { $match: { paper: { $exists: true, $ne: null, $ne: "" } } },
      { $group: { _id: { year: "$year", part: "$part", paper: "$paper" } } },
      { $count: "count" }
    ]),
    Bookmark.countDocuments({})
  ]);

  const response = {
    users,
    questions: Number(structuredQuestions || 0) + Number(legacyQuestions || 0),
    papers: Number(papersAgg?.[0]?.count || 0),
    bookmarks
  };

  setCache(cacheKey, response, ttlMs);
  return res.json(response);
};

export const getAdminStatsTimeseries = async (req, res) => {
  const granularity = (req.query.granularity || "").toString().toLowerCase();
  if (granularity === "month") {
    const rawMonths = req.query.months;
    const months = Math.min(60, Math.max(1, Number(rawMonths || 12) || 12));

    const cacheKey = `admin:stats:timeseries:month:${months}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const ttlMs = Math.max(10000, parseCacheTtlMs());

    const now = new Date();
    const currentMonthStart = utcStartOfMonth(now);
    const start = utcStartOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)));
    const endExclusive = utcStartOfMonth(
      new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + 1, 1))
    );

    const baseMatch = { createdAt: { $gte: start, $lt: endExclusive } };

    const [usersByMonth, structuredByMonth, legacyByMonth, papersByMonth, bookmarksByMonth] =
      await Promise.all([
        aggregateMonthlyCounts(User, { ...baseMatch, isDeleted: false, isActive: true }),
        aggregateMonthlyCounts(StructuredQuestion, baseMatch),
        aggregateMonthlyCounts(Question, baseMatch),
        aggregateMonthlyPaperCounts({ ...baseMatch, paper: { $exists: true, $ne: null, $ne: "" } }),
        aggregateMonthlyCounts(Bookmark, baseMatch)
      ]);

    const points = [];
    for (let i = 0; i < months; i++) {
      const monthStart = utcStartOfMonth(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)));
      const month = toMonthString(monthStart);
      const questions = (structuredByMonth.get(month) || 0) + (legacyByMonth.get(month) || 0);
      points.push({
        month,
        users: usersByMonth.get(month) || 0,
        questions,
        papers: papersByMonth.get(month) || 0,
        bookmarks: bookmarksByMonth.get(month) || 0
      });
    }

    const response = { points };
    setCache(cacheKey, response, ttlMs);
    return res.json(response);
  }

  const rawDays = req.query.days;
  const days = Math.min(365, Math.max(1, Number(rawDays || 30) || 30));

  const cacheKey = `admin:stats:timeseries:${days}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const ttlMs = Math.max(10000, parseCacheTtlMs());

  const now = new Date();
  const start = utcStartOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1))));
  const endExclusive = utcStartOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)));

  const baseMatch = { createdAt: { $gte: start, $lt: endExclusive } };

  const [usersByDay, structuredByDay, legacyByDay, papersByDay, bookmarksByDay] = await Promise.all([
    aggregateDailyCounts(User, { ...baseMatch, isDeleted: false, isActive: true }),
    aggregateDailyCounts(StructuredQuestion, baseMatch),
    aggregateDailyCounts(Question, baseMatch),
    aggregateDailyCounts(StructuredQuestion, { ...baseMatch, paper: { $exists: true, $ne: null, $ne: "" } }),
    aggregateDailyCounts(Bookmark, baseMatch)
  ]);

  const points = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const date = toDayString(day);
    const questions = (structuredByDay.get(date) || 0) + (legacyByDay.get(date) || 0);
    points.push({
      date,
      users: usersByDay.get(date) || 0,
      questions,
      papers: papersByDay.get(date) || 0,
      bookmarks: bookmarksByDay.get(date) || 0
    });
  }

  const response = { points };
  setCache(cacheKey, response, ttlMs);
  return res.json(response);
};
