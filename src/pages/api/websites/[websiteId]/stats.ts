import { subMinutes, differenceInMinutes } from 'date-fns';
import { NextApiResponse } from 'next';
import { methodNotAllowed, ok, unauthorized } from 'next-basics';
import { canViewWebsite } from 'lib/auth';
import { useAuth, useCors, useValidate } from 'lib/middleware';
import { NextApiRequestQueryBody, WebsiteStats } from 'lib/types';
import { parseDateRangeQuery } from 'lib/query';
import { getWebsiteStats } from 'queries';

export interface WebsiteStatsRequestQuery {
  websiteId: string;
  startAt: number;
  endAt: number;
  url?: string;
  urls?: string;
  referrer?: string;
  title?: string;
  query?: string;
  event?: string;
  os?: string;
  browser?: string;
  device?: string;
  country?: string;
  region?: string;
  city?: string;
}

import * as yup from 'yup';
import { urlsFilter } from 'lib/filters';
const schema = {
  GET: yup.object().shape({
    websiteId: yup.string().uuid().required(),
    startAt: yup.number().required(),
    endAt: yup.number().required(),
    url: yup.string(),
    urls: yup.string().matches(/^\/[^|]+\|?(\/[^|]+\|?)*$/, 'Invalid URLs format'),
    referrer: yup.string(),
    title: yup.string(),
    query: yup.string(),
    event: yup.string(),
    os: yup.string(),
    browser: yup.string(),
    device: yup.string(),
    country: yup.string(),
    region: yup.string(),
    city: yup.string(),
  }),
};

export default async (
  req: NextApiRequestQueryBody<WebsiteStatsRequestQuery>,
  res: NextApiResponse<WebsiteStats>,
) => {
  await useCors(req, res);
  await useAuth(req, res);
  await useValidate(schema, req, res);

  const {
    websiteId,
    url,
    urls,
    referrer,
    title,
    query,
    event,
    os,
    browser,
    device,
    country,
    region,
    city,
  }: any & { websiteId: string } = req.query;

  if (req.method === 'GET') {
    if (!(await canViewWebsite(req.auth, websiteId))) {
      return unauthorized(res);
    }

    const { startDate, endDate } = await parseDateRangeQuery(req);
    const diff = differenceInMinutes(endDate, startDate);
    const prevStartDate = subMinutes(startDate, diff);
    const prevEndDate = subMinutes(endDate, diff);

    const parsedUrls = urlsFilter(urls) ?? undefined;

    const filters = {
      url,
      urls: parsedUrls,
      referrer,
      title,
      query,
      event,
      os,
      browser,
      device,
      country,
      region,
      city,
    };

    const metrics = await getWebsiteStats(websiteId, { ...filters, startDate, endDate });

    const prevPeriod = await getWebsiteStats(websiteId, {
      ...filters,
      startDate: prevStartDate,
      endDate: prevEndDate,
    });

    const stats = Object.keys(metrics[0]).reduce((obj, key) => {
      obj[key] = {
        value: Number(metrics[0][key]) || 0,
        change: Number(metrics[0][key]) - Number(prevPeriod[0][key]) || 0,
      };
      return obj;
    }, {});

    return ok(res, stats);
  }

  return methodNotAllowed(res);
};
