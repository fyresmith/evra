/* The Evra file format (version 1).
   A timeline is one JSON file with the .evra extension. Dates are whole numbers: days counted from
   day 1 of year 0 of the timeline's own calendar. See docs/file-format.md. */

export type Side = 'a' | 'b'; // 'a' is left (vertical) or top (horizontal), 'b' is right or bottom
export type Orientation = 'ttb' | 'btt' | 'ltr' | 'rtl';

export interface RelPin {
	to: string; // the id of the card this one is pinned to
	from: 'start' | 'end';
	offset?: number; // days from the anchor, kept up to date
	at?: number; // where the anchor was last seen
}

export interface EvraEvent {
	id: string;
	t: number;
	end?: number; // a span when set
	side: Side;
	title: string;
	text: string;
	color: string | null; // a color preset id
	file: string | null; // a linked note, as a link path without ".md"
	os?: boolean; // unknown start
	oe?: boolean; // ongoing
	icon?: string;
	tags?: string[];
	circa?: number; // plus or minus this many days
	life?: boolean; // a span that is someone's life
	people?: string[]; // ids of lifespans involved
	rel?: RelPin;
	/** Reserved for sub-timelines: 1 to 3, higher shows in parent timelines. */
	importance?: number;
	/** Reserved for sub-timelines: always show in the parent timeline. */
	promote?: boolean;
}

export interface Era {
	id: string;
	parent: string | null;
	name: string;
	start: number;
	end: number;
	color: string | null;
	abbr?: string;
}

export interface Month {
	id: string;
	name: string;
	days: number;
	inter?: boolean; // festival (intercalary) days that belong to no month
}

export interface LeapRule {
	id: string;
	month: string; // month id
	days: number;
	every: number;
	except: number;
	unless: number;
	off: number;
}

export interface SecondCalendar {
	on: boolean;
	name: string;
	yearDays: number;
	offset: number;
	fmt: string;
	onCards: boolean;
}

export interface Formats {
	year: string;
	yearNeg: string;
	dateDay: string;
	dateMonth: string;
	dateYear: string;
	dateInter: string;
	circa: string;
	tickYear: string;
	tickMonth: string;
	tickDay: string;
	range: string;
	ongoing: string;
	shortRange: boolean;
}

export interface Units {
	day: string;
	month: string;
	year: string;
	years: string;
}

export interface Calendar {
	months: Month[];
	units: Units;
	fmt: Formats;
	yearStart: number;
	leaps: LeapRule[];
	weekdays: string[];
	weekStart: number;
	eraBase: 0 | 1;
	second: SecondCalendar;
}

export interface ColorPreset {
	id: string;
	name: string;
	hex: string | null; // null: a built-in that follows the theme
}

export type SyncKey = 'date' | 'year' | 'month' | 'day' | 'end' | 'era' | 'subera' | 'eras' | 'timeline';

export interface SyncField {
	on: boolean;
	key: string;
}

export interface SyncOpts {
	on: boolean;
	fields: Record<SyncKey, SyncField>;
	written: string[]; // property names this timeline has written
	notes?: string[]; // paths of notes this timeline has written to
}

export interface Opts {
	spanStyle: 'threads' | 'blocks';
	groupOver: number;
	snapTo: 'auto' | 'd' | 'm' | 'y';
	bands: boolean;
	subLabels: boolean;
	cardLines: number;
	tint: boolean;
	fadeFuture?: boolean;
	v: number;
	sync: SyncOpts;
}

export interface SavedView {
	id: string;
	name: string;
	a: number;
	b: number;
	x: number;
}

export interface EvraDoc {
	format?: 'evra';
	version?: number;
	name: string;
	cal: Calendar;
	palette: ColorPreset[];
	opts: Opts;
	range: [number, number]; // in years
	orientation: Orientation;
	cardWidth: number;
	eras: Era[];
	events: EvraEvent[];
	now?: number | null;
	views?: SavedView[];
	lastView?: [number, number];
	/** Reserved for sub-timelines: a link to the parent timeline. */
	parent?: string;
	/** Reserved for sub-timelines. */
	kind?: 'scope' | 'branch';
	/** Reserved for sub-timelines: where a branch splits from its parent. */
	forkAt?: number;
}

/** Settings shared by every timeline, saved with the plugin. */
export interface TimelineDefaults {
	cal: Calendar;
	palette: ColorPreset[];
	opts: Opts;
	cardWidth: number;
	orientation: Orientation;
}
