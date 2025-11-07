import path from "path";
import got from "got";
import { fromBuffer } from "file-type";
import isSvg from "is-svg";
import filenamify from "filenamify";

import { DIRTY_IMAGE_TAG, FORBIDDEN_SYMBOLS_FILENAME_PATTERN, IDomainAuth } from "./config";
/*
https://stackoverflow.com/a/48032528/1020973
It will be better to do it type-correct.

*/
export async function replaceAsync(str: any, regex: any, asyncFn: any) {
  const promises: Promise<any>[] = [];
  str.replace(regex, (match: string, ...args: any) => {
    const promise = asyncFn(match, ...args);
    promises.push(promise);
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift());
}

export function isUrl(link: string) {
  try {
    return Boolean(new URL(link));
  } catch (_) {
    return false;
  }
}

export function findAuthForUrl(url: string, domainAuths: IDomainAuth[]): IDomainAuth | undefined {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Find matching domain auth
    return domainAuths.find(auth => {
      const authDomain = auth.domain.toLowerCase().trim();
      // Support exact match and wildcard subdomain matching
      if (authDomain.startsWith('*.')) {
        const baseDomain = authDomain.substring(2);
        return hostname.endsWith(baseDomain);
      }
      return hostname === authDomain || hostname.endsWith('.' + authDomain);
    });
  } catch (error) {
    console.error('Error parsing URL for auth:', error);
    return undefined;
  }
}

export async function downloadImage(url: string, domainAuths: IDomainAuth[] = []): Promise<ArrayBuffer> {
  const auth = findAuthForUrl(url, domainAuths);
  
  const headers: Record<string, string> = {};
  
  if (auth) {
    // Add access token to Authorization header
    if (auth.accessToken) {
      headers['Authorization'] = auth.accessToken.startsWith('Bearer ') 
        ? auth.accessToken 
        : `Bearer ${auth.accessToken}`;
    }
    
    // Add cookie
    if (auth.cookie) {
      headers['Cookie'] = auth.cookie;
    }
    
    // Add custom headers
    if (auth.headers) {
      Object.assign(headers, auth.headers);
    }
  }
  
  const res = await got(url, { 
    responseType: "buffer",
    headers: Object.keys(headers).length > 0 ? headers : undefined
  });
  return res.body;
}

export async function fileExtByContent(content: ArrayBuffer) {
  const fileExt = (await fromBuffer(content))?.ext;

  // if XML, probably it is SVG
  if (fileExt == "xml") {
    const buffer = Buffer.from(content);
    if (isSvg(buffer)) return "svg";
  }

  return fileExt;
}

function recreateImageTag(match: string, anchor: string, link: string) {
  return `![${anchor}](${link})`;
}

export function cleanContent(content: string) {
  const cleanedContent = content.replace(DIRTY_IMAGE_TAG, recreateImageTag);
  return cleanedContent;
}

export function cleanFileName(name: string) {
  const cleanedName = filenamify(name).replace(
    FORBIDDEN_SYMBOLS_FILENAME_PATTERN,
    "_"
  );
  return cleanedName;
}

export function pathJoin(dir: string, subpath: string): string {
  const result = path.join(dir, subpath);
  // it seems that obsidian do not understand paths with backslashes in Windows, so turn them into forward slashes
  return result.replace(/\\/g, "/");
}
