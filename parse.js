// abc2svg - parse.js - ABC parse
//
// Copyright (C) 2014-2016 Jean-Francois Moine
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License version 2 as
// published by the Free Software Foundation.");

var	a_gch,		// array of parsed guitar chords
	a_dcn,		// array of parsed decoration names
	multicol,	// multi column object
	maps		// maps object - hashcode = map name
			//	-> object - hashcode = note
			//	[0] array of heads
			//	[1] print
			//	[2] color
const	not_ascii = "Not an ASCII character"

// -- %% pseudo-comment

// clef definition (%%clef, K: and V:)
function new_clef(clef_def) {
	var	s = {
			type: CLEF,
			ctx: parse.ctx,
			istart: parse.istart,
			iend: parse.iend,
			clef_line: 2,
			clef_type: "t"
		},
		i = 1

	switch (clef_def[0]) {
	case '"':
		i = clef_def.indexOf('"');
		s.clef_name = clef_def.slice(1, i);
		i++
		break
	case 'a':
		if (clef_def[1] == 'u') {	// auto
			s.clef_type = "a";
			s.clef_auto = true;
			i = 4
			break
		}
		i = 4				// alto
	case 'C':
		s.clef_type = "c";
		s.clef_line = 3
		break
	case 'b':				// bass
		i = 4
	case 'F':
		s.clef_type = "b";
		s.clef_line = 4
		break
	case 'n':				// none
		i = 4
		s.invis = true
		break
	case 't':
		if (clef_def[1] == 'e') {	// tenor
			s.clef_type = "c";
			s.clef_line = 4
			break
		}
		i = 6
	case 'G':
//		s.clef_type = "t"		// treble
		break
	case 'p':
		i = 4
	case 'P':				// perc
		s.clef_type = "p"
		s.clef_line = 3
		break
	default:
		parse.line.error("Unknown clef '$1'", clef_def)
		delete s
		return undefined
	}
	if (clef_def[i] >= '1' && clef_def[i] <= '9') {
		s.clef_line = Number(clef_def[i]);
		i++
	}
	if (clef_def[i + 1] != '8')
		return s
	switch (clef_def[i]) {			// octave
	case '^':
		s.clef_oct_transp = true
	case '+':
		s.clef_octave = 7
		break
	case '_':
		s.clef_oct_transp = true
	case '-':
		s.clef_octave = -7
		break
	default:
		return s
	}
	return s
}

// get a %%transpose value
const pit_st = [0, 2, 4, 5, 7, 9, 11]

function get_transp(param) {
	var val, tmp, note, pit = []

	if (param[0] == '0')
		return 0
	if ("123456789-+".indexOf(param[0]) >= 0) {	// by semi-tone
		val = parseInt(param) * 3
		if (isNaN(val) || val < -108 || val > 108) {
			parse.line.error("Bad %%transpose value")
			return
		}
		switch (param.slice(-1)) {
		default:
			return val
		case '#':
			val++
			break
		case 'b':
			val += 2
			break
		}
		if (val > 0)
			return val
		return val - 3
	}

	// by music interval
	tmp = new scanBuf();
	tmp.buffer = param;
	tmp.index = 0;
	tmp.ctx = parse.ctx;
	for (i = 0; i < 2; i++) {
		note = parse_acc_pit(tmp)
		if (!note) {
			parse.line.error("Bad %%transpose value")
			return
		}
		note.pit += 126 - 2;		// for value > 0 and 'C' % 7 == 0
		val = ((note.pit / 7) | 0) * 12 + pit_st[note.pit % 7]
		if (note.acc && note.acc != 3)		// if ! natural
			val += note.acc;
		pit[i] = val
	}
	val = (pit[1] - pit[0]) * 3
	switch (note.acc) {
	default:
		return val
	case 2:
	case 1:
		val++
		break
	case -1:
	case -2:
		val += 2
		break
	}
	if (val > 0)
		return val
	return val - 3
}

// set the linebreak character
function set_linebreak(param) {
	var i, item

	for (i = 0; i < 128; i++) {
		if (char_tb[i] == "\n") {
			char_tb[i] = nil	// remove old definition
			break
		}
	}
	param = param.split(/\s+/)
	for (i = 0; i < param.length; i++) {
		item = param[i]
		switch (item) {
		case '!':
		case '$':
		case '*':
		case ';':
		case '?':
		case '@':
			break
		case "<none>":
			continue
			break
		case "<EOL>":
			item = '\n'
			break
		default:
			parse.line.error("Bad value '$1' in %%linebreak - ignored",
					item)
			continue
		}
		char_tb[item.charCodeAt(0)] = '\n'
	}
}

// set a new user character (U: or %%user)
function set_user(param) {
	var	k, val,
		c = param[0],
		c2 = '!',
		i = param.indexOf('!'),
		j = param.indexOf('"')

	if (i < 0) {
		if (j < 0) {
			parse.line.error('Lack of starting ! or " in U: / %%user')
			return
		}
		c2 = '"';
		i = j
	} else if (j > 0 && j < i) {
		c2 = '"';
		i = j
	}

	j = param.indexOf(c2, i + 1)
	if (j < 0) {
		parse.line.error("Lack of ending $1 in U:/%%user", c2)
		return
	}
	if (c == '\\') {
		c = param[1]
		if (c == 't')
			c = '\t'
	}
	k = c.charCodeAt(0)
	if (k >= 128) {
		parse.line.error(not_ascii)
		return
	}
	switch (char_tb[k][0]) {
	case '0':			// nil
	case 'd':
	case 'i':
	case ' ':
		break
	case '"':
	case '!':
		if (char_tb[k].length > 1)
			break
		// fall thru
	default:
		parse.line.error("Bad user character '$1'", c)
		return
	}
	val = param.slice(i, j + 1)
	switch (val) {
	case "!beambreak!":
		val = " "
		break
	case "!ignore!":
		val = "i"
		break
	case "!nil!":
	case "!none!":
		val = "d"
		break
	}
	char_tb[k] = val
}

// get a stafflines value
function get_st_lines(param) {
	var n, val

	if (param[0] == '|' || param[0] == '.')
//fixme: should check if only '|' and '.', and no '.' at the end except when only '.'s
		return param
	n = parseInt(param)
	switch (n) {
	case 0: return '...'
	case 1: return '..|'
	case 2: return '.||'
	case 3: return '|||.'
	}
	if (isNaN(n) || n < 0 || n > 16)
		return undefined
	val = '|'
	while (--n > 0)
		val += '|'
	return val
}

// create a text block in the tune body
function new_block(subtype) {
	var s = {
		type: BLOCK,
		subtype: subtype
	}

	if (parse.state == 2)
		goto_tune()
	curvoice = voice_tb[0]
//fixme: should search the control voice
	if (curvoice.last_sym)
		curvoice.last_sym.eoln = true;
	sym_link(s)
	return s
}

function next_word(param, i) {
	while (param[i] && param[i] != ' ')
		i++
	while (param[i] == ' ')
		i++
	return i
}

// K: / V: common arguments
// return the clef if any
function parse_kv_args(a) {
	var	s, item,
		voice_param = curvoice

	// if no current voice, this is the first K:
	// the voice parameters will be set in goto_tune()
	if (!voice_param)
		voice_param = parse.voice_param = {}

	while (1) {
		item = a.shift()
		if (!item)
			break
		switch (item) {
		case "clef=":
			s = new_clef(a.shift())
			break
		case "octave=":
//fixme: no if inside tune
//			if (voice_param.octave) {
//				parse.line.error("Double 'octave='")
//				break
//			}
			voice_param.octave = Number(a.shift())
			break
		case "map=":
			voice_param.map = a.shift()
			break
		case "cue=":
//			if (voice_param.scale) {
//				parse.line.error("Double 'scale='/'cue='")
//				break
//			}
			voice_param.scale = a.shift() == 'on' ? 0.7 : 1
			break
		case "stafflines=":
			item = get_st_lines(a.shift())
			if (!item) {
				parse.line.error("Bad stafflines= value")
				break
			}
			voice_param.stafflines = item
			break
//		case "staffscale=":
//			voice_param.staffscale = Number(a.shift())
//			break
//		case "middle":
//			a.shift()
//			break			// middle= ignored
		default:
			switch (item.slice(0, 4)) {
			case "treb":
			case "bass":
			case "alto":
			case "teno":
			case "perc":
				s = new_clef(item)
				break
			default:
				if ("GFC".indexOf(item[0]) >= 0)
					s = new_clef(item)
				else if (item.slice(-1) == '=')
					a.shift()
				break
			}
			break
		}
	}
	return s
}

// K: key signature
// return the key and the optional clef
function new_key(param) {
	var	i, clef, key_end, c, tmp,
//		mode,
		s = {
			type: KEY,
			ctx: parse.ctx,
			istart: parse.istart,
			iend: parse.iend,
			k_delta: 0
		}

	if (!param.length)
		return [s, null]

	// tonic
//	mode = 0;
	i = 1
	switch (param[0]) {
	case 'A': s.k_sf = 3; break
	case 'B': s.k_sf = 5; break
	case 'C': s.k_sf = 0; break
	case 'D': s.k_sf = 2; break
	case 'E': s.k_sf = 4; break
	case 'F': s.k_sf = -1; break
	case 'G': s.k_sf = 1; break
	case 'H':				// bagpipe
		switch (param[1]) {
		case 'P':
			s.k_bagpipe = "P";
			i++
			break
		case 'p':
			s.k_bagpipe = "p";
			s.k_sf = 2;
			i++
			break
		default:
			parse.line.error("Unknown bagpipe-like key")
			break
		}
		key_end = true
		break
	case 'P':
		s.k_drum = true;
		key_end = true
		break
	case 'n':				// none
		if (param.indexOf("none") == 0) {
			s.k_sf = 0;
			s.k_none = true;
			i = 4
		}
		// fall thru
	default:
		key_end = true
		break
	}

	if (!key_end) {
		switch (param[i]) {
		case '#': s.k_sf += 7; i++; break
		case 'b': s.k_sf -= 7; i++; break
		}
		param = param.slice(i).trim()
		switch (param.slice(0, 3).toLowerCase()) {
		case "aeo":
		case "m":
		case "min": s.k_sf -= 3;
//			mode = 5;
			break
		case "dor": s.k_sf -= 2;
//			mode = 1;
			break
		case "ion":
		case "maj": break
		case "loc": s.k_sf -= 5;
//			mode = 6;
			break
		case "lyd": s.k_sf += 1;
//			mode = 3;
			break
		case "mix": s.k_sf -= 1;
//			mode = 4;
			break
		case "phr": s.k_sf -= 4;
//			mode = 2;
			break
		default:
			if (param[0] == 'm'
			 && (param[1] == ' ' || param[1] == '\t'
			  || param[1] == '\n')) {
				s.k_sf -= 3;
//				mode = 5
				break
			}
			key_end = true
			break
		}
		if (!key_end)
			param = param.replace(/\w+\s*/, '')

		// [exp] accidentals
		if (param.indexOf("exp ") == 0) {
			param = param.replace(/\w+\s*/, '')
			if (!param)
				parse.line.error("No accidental after 'exp'")
			s.k_exp = true
		}
		c = param[0]
		if (c == '^' || c == '_' || c == '=') {
			s.k_a_acc = []
			tmp = new scanBuf();
			tmp.buffer = param;
			tmp.index = 0;
			tmp.ctx = parse.ctx
			do {
				var note = parse_acc_pit(tmp)
				if (!note)
					return [s, null]
				var acc = {
					pit: note.pit,
					acc: note.acc
				}
				s.k_a_acc.push(acc);
				c = tmp.char()
				while (c == ' ')
					c = tmp.next_char()
			} while (c == '^' || c == '_' || c == '=');
			param = param.slice(tmp.index)
		} else if (s.k_exp && param.indexOf("none") == 0) {
//			s.k_a_acc = [];
			s.k_sf = 0;
			param = param.replace(/\w+\s*/, '')
		}
	}

	s.k_delta = (cgd2cde[(s.k_sf + 7) % 7] + 14) % 7

	if (!param)
		return [s, null]	// key only
	return [s, parse_kv_args(info_split(param, 0))]
}

// M: meter
function new_meter(text) {
	var	s = {
			type: METER,
			ctx: parse.ctx,
			istart: parse.istart,
			iend: parse.iend,
			a_meter: []
		},
		meter = {},
		val, v,
		m1 = 0, m2,
		i = 0, j,
		wmeasure,
		p = text,
		in_parenth

	if (p.indexOf("none") == 0) {
		i = 4;				/* no meter */
		wmeasure = 1;	// simplify measure numbering and MREST conversion
	} else {
		wmeasure = 0
		while (i < text.length) {
			if (p[i] == '=')
				break
			switch (p[i]) {
			case 'C':
				meter.top = p[i++]
				if (p[i] == '|')
					meter.top += p[i++];
				m1 = 4;
				m2 = 4;
				break
			case 'c':
			case 'o':
				m1 = p[i] == 'c' ? 4 : 3;
				m2 = 4;
				meter.top = p[i++]
				if (p[i] == '.')
					meter.top += p[i++]
				break
			case '(':
				if (p[i + 1] == '(') {	/* "M:5/4 ((2+3)/4)" */
					in_parenth = true;
					meter.top = p[i++];
					s.a_meter.push(meter);
					meter = {}
				}
				j = i + 1
				while (j < text.length) {
					if (p[j] == ')' || p[j] == '/')
						break
					j++
				}
				if (p[j] == ')' && p[j + 1] == '/') {	/* "M:5/4 (2+3)/4" */
					i++		/* remove the parenthesis */
					continue
				}			/* "M:5 (2+3)" */
				/* fall thru */
			case ')':
				in_parenth = p[i] == '(';
				meter.top = p[i++];
				s.a_meter.push(meter);
				meter = {}
				continue
			default:
				if (p[i] <= '0' || p[i] > '9') {
					parse.line.error("Bad char '$1' in M:", p[i])
					return
				}
				m2 = 2;			/* default when no bottom value */
				meter.top = p[i++]
				for (;;) {
					while (p[i] >= '0' && p[i] <= '9')
						meter.top += p[i++]
					if (p[i] == ')') {
						if (p[i + 1] != '/')
							break
						i++
					}
					if (p[i] == '/') {
						i++;
						if (p[i] <= '0' || p[i] > '9') {
							parse.line.error("Bad char '$1' in M:", p[i])
							return
						}
						meter.bot = p[i++]
						while (p[i] >= '0' && p[i] <= '9')
							meter.bot += p[i++]
						break
					}
					if (p[i] != ' ' && p[i] != '+')
						break
					if (i >= text.length
					 || p[i + 1] == '(')	/* "M:5 (2/4+3/4)" */
						break
					meter.top += p[i++]
				}
				m1 = parseInt(meter.top)
				break
			}
			if (!in_parenth) {
				if (meter.bot)
					m2 = parseInt(meter.bot);
				wmeasure += m1 * BASE_LEN / m2
			}
			s.a_meter.push(meter);
			meter = {}
			while (p[i] == ' ')
				i++
			if (p[i] == '+') {
				meter.top = p[i++];
				s.a_meter.push(meter);
				meter = {}
			}
		}
	}
	if (p[i] == '=') {
		val = p.substring(++i)
		if (!val.match(/^(\d|\/)+$/)) {
			parse.line.error("Bad duration '$1' in M:", val)
			return
		}
		wmeasure = BASE_LEN * eval(val)
	}
	s.wmeasure = wmeasure

	if (parse.state != 3) {
		info.M = text;
		glovar.meter = s
		if (parse.state >= 1) {

			/* in the tune header, change the unit note length */
			if (!glovar.ulen) {
				if (wmeasure <= 1
				 || wmeasure >= BASE_LEN * 3 / 4)
					glovar.ulen = BASE_LEN / 8
				else
					glovar.ulen = BASE_LEN / 16
			}
			for (v = 0; v < voice_tb.length; v++) {
				voice_tb[v].meter = s;
				voice_tb[v].wmeasure = wmeasure
			}
		}
	} else {
		curvoice.wmeasure = wmeasure
		if (is_voice_sig()) {
			curvoice.meter = s;
			reset_gen()
		} else {
			sym_link(s)
		}
	}
}

/* Q: tempo */
function new_tempo(text) {
	if (cfmt.writefields.indexOf('Q') < 0)
		return

	var	i = 0, j, c, nd, tmp,
		s = {
			type: TEMPO,
			ctx: parse.ctx,
			istart: parse.istart,
			iend: parse.iend
		}

	/* string before */
	if (text[0] == '"') {
		i = text.indexOf('"', 1)
		if (i < 0) {
			parse.line.error("Unterminated string in Q:")
			return
		}
		s.tempo_str1 = text.slice(1, i);
		i++
		while (text[i] == ' ')
			i++
	}

	/* beat */
	tmp = new scanBuf();
	tmp.buffer = text;
	tmp.index = i
	while (1) {
		c = tmp.char()
		if (c == undefined || c <= '0' || c > '9')
			break
		nd = parse_dur(tmp)
		if (!s.tempo_notes)
			s.tempo_notes = []
		s.tempo_notes.push(BASE_LEN * nd[0] / nd[1])
		while (1) {
			c = tmp.char()
			if (c != ' ')
				break
			tmp.advance()
		}
	}

	/* tempo value */
	if (c == '=') {
		c = tmp.next_char()
		while (c == ' ')
			c = tmp.next_char();
		i = tmp.index
		if (c == 'c' && text[i + 1] == 'a'
		 && text[i + 2] == '.' && text[i + 3] == ' ') {
			s.tempo_ca = 'ca. ';
			tmp.index += 4;
			c = tmp.char()
		}
//		if (c > '0' && c <= '9') {
//fixme: if "n/d", 'n' may be > 9 - not treated
		if (text[tmp.index + 1] != '/') {
			s.tempo = tmp.get_int()
		} else {
			nd = parse_dur(tmp);
			s.new_beat = BASE_LEN * nd[0] / nd[1]
		}
		c = tmp.char()
		while (c == ' ')
			c = tmp.next_char();
	}

	/* string after */
	if (c == '"') {
		tmp.advance();
		i = text.indexOf('"', tmp.index + 1)
		if (i < 0) {
			parse.line.error("Unterminated string in Q:")
			return
		}
		s.tempo_str2 = text.slice(tmp.index, i)
	}

	if (parse.state != 3) {
		if (parse.state == 1) {			// tune header
			info.Q = text;
			glovar.tempo = s;
			return
		}
		goto_tune()				// tune header after K:
	}
	if (curvoice.v != par_sy.top_voice)
		return				/* tempo only for first voice */
//--fixme				/* keep last Q: */
	sym_link(s)
}

// treat the information fields which may embedded
// return the info field type if possible continuation
function do_info(info_type, text) {
	var s

	switch (info_type) {

	// info fields in any state
	case 'I':
		do_pscom(text)
		break
	case 'L':
		if (text.match(/^\d*\/\d*$/)) {
			text = BASE_LEN * eval(text)
		} else if (text == "auto") {
			text = -1
		} else {
			parse.line.error("Bad L: value")
			break
		}
		if (parse.state == 2)
			goto_tune()
		if (parse.state != 3)
			glovar.ulen = Number(text)
		else
			curvoice.ulen = Number(text)
		break
	case 'M':
		new_meter(text)
		break
	case 'U':
		set_user(text)
		break

	// fields in tune header or tune body
	case 'P':
		if (parse.state == 0)
			break
		if (parse.state == 1) {
			info.P = text
			break
		}
		if (parse.state == 2)
			goto_tune()
		if (cfmt.writefields.indexOf('P') < 0)
			break
		s = {
			type: PART,
			ctx: parse.ctx,
			istart: parse.istart,
			iend: parse.iend,
			text: text
		}

		/*
		 * If not in the main voice, then,
		 * if the voices are synchronized and no P: yet in the main voice,
		 * the misplaced P: goes into the main voice.
		 */
		var p_voice = voice_tb[par_sy.top_voice]
		if (curvoice.v != p_voice.v) {
			if (curvoice.time != p_voice.time)
				break
			if (p_voice.last_sym && p_voice.last_sym.type == PART)
				break		// already a P:
			var curvoice_sav = curvoice;
			curvoice = p_voice;
			sym_link(s);
			curvoice = curvoice_sav
		} else {
			sym_link(s)
		}
		break
	case 'Q':
		if (parse.state == 0)
			break
		new_tempo(text)
		break
	case 'V':
		if (parse.state == 0)
			break
		if (parse.state == 2)
			goto_tune();
		get_voice(text)
		if (!curvoice.last_sym
		 && parse.voice_opts)
			voice_filter()
		break

	// key signature and end of tune header
	case 'K':
		get_key_clef(new_key(text))
		break

	// note mapping
	case 'k':
		parse.line.error("k: is obsolete - use %%map instead")
		get_map(text)
		break

	// info in any state
	case 'N':
	case 'R':
		if (!info[info_type])
			info[info_type] = text
		else
			info[info_type] += '\n' + text
		break
	case 'r':
		if (!user.keep_remark
		 || parse.state != 3)
			break
		s = {
			type: REMARK,
			ctx: parse.ctx,
			istart: parse.istart,
			iend: parse.iend,
			text: text
		}
		sym_link(s)
		break
	default:
		parse.line.error("'$1:' line ignored", info_type)
		break
	}
}

// music line parsing functions

/* -- adjust the duration and time of symbols in a measure when L:auto -- */
function adjust_dur(s) {
	var s2, time, auto_time, i, res;

	/* search the start of the measure */
	s2 = curvoice.last_sym
	if (!s2)
		return;

	/* the bar time is correct if there are multi-rests */
	if (s2.type == MREST
	 || s2.type == BAR)			/* in second voice */
		return
	while (s2.type != BAR && s2.prev)
		s2 = s2.prev;
	time = s2.time;
	auto_time = curvoice.time - time

	/* remove the invisible rest at start of tune */
	if (time == 0) {
		while (s2 && !s2.dur)
			s2 = s2.next
		if (s2 && s2.type == REST
		 && s2.invis) {
			time += s2.dur * curvoice.wmeasure / auto_time
			if (s2.prev)
				s2.prev.next = s2.next
			else
				curvoice.sym = s2.next
			if (s2.next)
				s2.next.prev = s2.prev;
			s2 = s2.next
		}
	}
	if (curvoice.wmeasure == auto_time)
		return				/* already good duration */

	for ( ; s2; s2 = s2.next) {
		s2.time = time
		if (!s2.dur || s2.grace)
			continue
		s2.dur = s2.dur * curvoice.wmeasure / auto_time;
		s2.dur_orig = s2.dur_orig * curvoice.wmeasure / auto_time;
		time += s2.dur
		if (s2.type != NOTE && s2.type != REST)
			continue
		for (i = 0; i <= s2.nhd; i++)
			s2.notes[i].dur = s2.notes[i].dur
					 * curvoice.wmeasure / auto_time;
		res = identify_note(s2, s2.dur_orig);
		s2.head = res[0];
		s2.dots = res[1];
		s2.nflags = res[2]
		if (s2.nflags <= -2)
			s2.stemless = true
		else
			delete s2.stemless
	}
	curvoice.time = s.time = time
}

/* -- parse a bar -- */
function new_bar() {
	var	s2, c, bar_type,
		line = parse.line,
		s = {
			type: BAR,
			ctx: parse.ctx,
//temporary
//			istart: parse.istart,
//			iend: parse.iend,
			multi: 0		// needed for decorations
		}

//temporary
	s.istart = parse.bol + line.index

	if (vover && vover.bar)			// end of voice overlay
		get_vover('|')
	if (glovar.new_nbar) {			// %%setbarnb
		s.bar_num = glovar.new_nbar;
		glovar.new_nbar = 0
	}
	bar_type = line.char()
	while (1) {
		c = line.next_char()
		switch (c) {
		case '|':
		case '[':
		case ']':
		case ':':
			bar_type += c
			continue
		}
		break
	}
	if (bar_type[0] == ':') {
		if (bar_type.length == 1) {	// ":" alone
			bar_type = '|';
			s.bar_dotted = true
		} else {
			s.rbstop = 2		// right repeat with end
		}
	}

/*	curvoice.last_note = NULL; */

	// set the guitar chord and the decorations
	if (a_gch)
		gch_build(s);
	if (a_dcn) {
		deco_cnv(a_dcn, s);
		a_dcn = null
	}

	/* if the last element is '[', it may start
	 * a chord, an embedded header or an other bar */
	switch (bar_type.slice(-1)) {
	case '[':
		if (bar_type.length == 1) {
			s.text = ''
			break
		}
		bar_type = bar_type.slice(0, -1);
		line.index--;
		c = '['
		break
	case ':':				// left repeat
		s.rbstop = 2			// with bracket end
		break
	}

	// check if repeat bar
	if (c > '0' && c <= '9') {
		s.text = c
		while (1) {
			c = line.next_char()
			if ("0123456789,.-".indexOf(c) < 0)
				break
			s.text += c
		}
		s.rbstop = 2;
		s.rbstart = 2
	} else if (c == '"' && bar_type == "[") {
//		s.text = ""
		while (1) {
			c = line.next_char()
			if (!c) {
				line.error("No end of repeat string")
				return
			}
			if (c == '"') {
				line.advance()
				break
			}
			if (c == '\\') {
				s.text += c
				c = line.next_char()
			}
			s.text += c
		}
		s.text = cnv_escape(s.text);
		s.rbstop = 2;
		s.rbstart = 2
	}

	// ']' as the first character indicates a repeat bar stop
	if (bar_type[0] == ']') {
		s.rbstop = 2			// with end
		if (bar_type.length != 1)
			bar_type = bar_type.slice(1);
		else
			s.invis = true
	}

//temporary
	s.iend = parse.bol + line.index

	if (s.rbstart
	 && curvoice.norepbra
	 && !curvoice.second)
		s.norepbra = true

	if (curvoice.ulen < 0)			// L:auto
		adjust_dur(s)

	s2 = curvoice.last_sym
	if (s2 && s2.type == BAR) {

		/* remove the invisible repeat bars when no shift is needed */
		if (bar_type == "["
//		 && (curvoice.v == par_sy.top_voice
		 && !s2.text && !s2.a_gch
		 && (curvoice.st == 0
		  || (par_sy.staves[curvoice.st - 1].flags & STOP_BAR)
		  || s.norepbra)) {
			if (s.text)
				s2.text = s.text
			if (s.a_gch)
				s2.a_gch = s.a_gch
			if (s.norepbra)
				s2.norepbra = s.norepbra
			if (s.rbstart)
				s2.rbstart = s.rbstart
			if (s.rbstop)
				s2.rbstop = s.rbstop
//--fixme: pb when on next line and empty staff above
			return
		}

		/* merge back-to-back repeat bars */
		if (bar_type == "|:"
		 && !s.text) {
			if (s2.bar_type == ":|") {
				s2.bar_type = "::";
				s2.rbstop = 2
				return
			}
			if (s2.bar_type == "||") {
				s2.bar_type = "||:";
				s2.rbstop = 2
				return
			}
		}
	}

	/* set some flags */
	switch (bar_type) {
	case "[":
		s.rbstop = 2
	case "[]":
	case "[|]":
		s.invis = true;
		bar_type = "[]"
		break
	case ":|:":
	case ":||:":
		bar_type = "::"
		break
	case "||":
		if (!cfmt.rbdbstop)
			break
	case "[|":
	case "|]":
		s.rbstop = 2
		break
	}
	s.bar_type = bar_type
	if (!curvoice.lyric_restart)
		curvoice.lyric_restart = s

	/* the bar must appear before a key signature */
//	s2 = curvoice.last_sym
	if (s2 && s2.type == KEY
	 && (!s2.prev || s2.prev.type != BAR)) {
		curvoice.last_sym = s2.prev
		if (!curvoice.last_sym)
			curvoice.sym = null;
		sym_link(s);
		s.next = s2;
		s2.prev = s;
		curvoice.last_sym = s2
	} else {
		sym_link(s)
	}
	s.st = curvoice.st			/* original staff */

	/* if repeat bar and shift, add a repeat bar */
	if (s.rbstart
	 && !curvoice.norepbra
	 && curvoice.st > 0
	 && !(par_sy.staves[curvoice.st - 1].flags & STOP_BAR)) {
// ko: always shift!
//	if (s.text) {
		s2 = {
			type: BAR,
			ctx: s.ctx,
			istart: s.istart,
			iend: s.iend,
			bar_type: "[",
			multi: 0,
			invis: true,
			text: s.text,
			rbstart: 2
		}
		sym_link(s2);
		s2.st = curvoice.st;
		s.text = undefined;
		s.rbstart = 0
	}
}

/* -- parse %%staves / %%score -- */
function parse_staves(param) {
	var	v, p_flags, v_id,
		a_flags = [],
		err = false,
		flags = 0,
		brace = 0,
		bracket = 0,
		parenth = 0,
		flags_st = 0,
		p = param,
		i = 0

	/* parse the voices */
	while (i < p.length) {
		switch (p[i]) {
		case ' ':
		case '\t':
			break
		case '[':
			if (parenth || brace + bracket >= 2) {
				parse.line.error("Misplaced '[' in %%staves");
				err = true
				break
			}
			flags |= brace + bracket == 0 ? OPEN_BRACKET : OPEN_BRACKET2;
			bracket++;
			flags_st <<= 8;
			flags_st |= OPEN_BRACKET
			break
		case '{':
			if (parenth || brace || bracket >= 2) {
				parse.line.error("Misplaced '{' in %%staves");
				err = true
				break
			}
			flags |= !bracket ? OPEN_BRACE : OPEN_BRACE2;
			brace++;
			flags_st <<= 8;
			flags_st |= OPEN_BRACE
			break
		case '(':
			if (parenth) {
				parse.line.error("Misplaced '(' in %%staves");
				err = true
				break
			}
			flags |= OPEN_PARENTH;
			parenth++;
			flags_st <<= 8;
			flags_st |= OPEN_PARENTH
			break
		case '*':
			if (brace && !parenth && !(flags & (OPEN_BRACE | OPEN_BRACE2)))
				flags |= FL_VOICE
			break
		case '+':
			flags |= MASTER_VOICE
			break
		default:
			if (!p[i].match(/\w/)) {
				parse.line.error("Bad voice ID in %%staves");
				err = true
				break
			}

			/* get / create the voice in the voice table */
			v_id = ""
			while (i < p.length) {
				if (" \t()[]{}|*".indexOf(p[i]) >= 0)
					break
				v_id += p[i++]
			}
			p_flags = {
				v: new_voice(v_id).v
			}
			for ( ; i < p.length; i++) {
				switch (p[i]) {
				case ' ':
				case '\t':
					continue
				case ']':
					if (!(flags_st & OPEN_BRACKET)) {
						parse.line.error("Misplaced ']' in %%staves");
						err = true
						break
					}
					bracket--;
					flags |= brace + bracket == 0 ?
							CLOSE_BRACKET :
							CLOSE_BRACKET2;
					flags_st >>= 8
					continue
				case '}':
					if (!(flags_st & OPEN_BRACE)) {
						parse.line.error("Misplaced '}' in %%staves");
						err = true
						break
					}
					brace--;
					flags |= !bracket ?
							CLOSE_BRACE :
							CLOSE_BRACE2;
					flags &= ~FL_VOICE;
					flags_st >>= 8
					continue
				case ')':
					if (!(flags_st & OPEN_PARENTH)) {
						parse.line.error("Misplaced ')' in %%staves");
						err = true
						break
					}
					parenth--;
					flags |= CLOSE_PARENTH;
					flags_st >>= 8
					continue
				case '|':
					flags |= STOP_BAR
					continue
				}
				break
			}
			p_flags.flags = flags;
			a_flags.push(p_flags);
			flags = 0
//			if (i >= p.length)
//				break
			continue
		}
		i++
	}
	if (flags_st != 0) {
		parse.line.error("'}', ')' or ']' missing in %%staves");
		err = true
	}
	if (err || a_flags.length == 0)
		return null
	return a_flags
}

// split an info string
function info_split(text,
		    start) {		// handle 'key=' after 'start' items
	var	a = [],
		item = "",
		i, j,
		n = text.length

	for (i = 0 ; i < n; i++) {
		switch (text[i]) {
		case '=':
			if (!item) {
				item = '='
				break
			}
			item += '='
			if (a.length < start)
				break
			a.push(item);
			item = ""
			break
		case ' ':
		case '\t':
			if (!item)
				break
			a.push(item);
			item = ""
			break
		case '"':
			if (item) {
				a.push(item);
				item = ""
			}
			j = ++i
			while (i < n) {
				if (text[i] == '"')
					break
				if (text[i] == '\\')
					i++;
				i++
			}
			if (text[i] != '"') {
				parse.line.error("Unterminated string")
				break
			}
			a.push(text.slice(j, i))
			break
		case '\\':
			item += text[i++]
			// fall thru
		default:
			item += text[i]
			break
		}
	}
	if (item)
		a.push(item)
	return a
}

/* -- parse the voice parameters (V:) -- */
/* return the clef if defined here */
function parse_voice(param) {
	var	v,
		a = info_split(param, 1),
		item = a.shift();

	// get/create the voice from its ID and switch to it
	curvoice = new_voice(item)
	if (curvoice.time == undefined) {	// new voice
		curvoice.time = 0
		if (parse.state == 3		// tune body
		 && staves_found < 0) {
			v = curvoice.v;
			curvoice.st = curvoice.cst = ++nstaff;
			par_sy.nstaff = nstaff;
			par_sy.voices[v].st = nstaff;
			par_sy.voices[v].range = v;
			par_sy.staves[nstaff] = {
				stafflines: "|||||",
				staffscale: 1
			}
		}
	}
	
	for (var i = 0; i < a.length; i++) {
		switch (a[i]) {
		case "name=":
		case "nm=":
			curvoice.nm = a[++i];
			curvoice.new_name = true
			break
		case "subname=":
		case "sname=":
		case "snm=":
			curvoice.snm = a[++i]
			break
//		case "merge":
//			break
		case "stem=":
			set_pos("stem", a[++i])
			break
		default:
			if (a[i].slice(-1) == '=')
				i++
			break
		}
	}
	return parse_kv_args(a)
}

/* -- get head type, dots, flags of note/rest for a duration -- */
function identify_note(s, dur) {
	var head, dots, flags

	if (dur % 12 != 0)
		parse.line.error("Invalid note duration $1", dur);
	dur /= 12			/* see BASE_LEN for values */
//	dur = Math.round(dur / 12)
	if (dur == 0)
		parse.line.error("Note too short")
	for (flags = 5; dur != 0; dur >>= 1, flags--) {
		if (dur & 1)
			break
	}
	dur >>= 1
	switch (dur) {
	case 0: dots = 0; break
	case 1: dots = 1; break
	case 3: dots = 2; break
//	case 7: dots = 3; break
	default:
		dots = 3
		break
	}
	flags -= dots
//--fixme: is 'head' useful?
	if (flags >= 0) {
		head = FULL
	} else switch (flags) {
	default:
		parse.line.error("Note too long");
		flags = -4
		/* fall thru */
	case -4:
		head = SQUARE
		break
	case -3:
		head = cfmt.squarebreve ? SQUARE : OVALBARS
		break
	case -2:
		head = OVAL
		break
	case -1:
		head = EMPTY
		break
	}
	return [head, dots, flags]
}

// parse a duration and return [numerator, denominator]
// 'line' is not always 'parse.line'
var reg_dur = /(\d*)(\/*)(\d*)/g		/* (stop comment) */

function parse_dur(line) {
	var res, num, den;

	reg_dur.lastIndex = line.index;
	res = reg_dur.exec(line.buffer)
	if (!res[0])
		return [1, 1]
	num = res[1] || 1;
	den = res[3] || 1;
	if (!res[3])
		den *= 1 << res[2].length;
	line.index = reg_dur.lastIndex
//	c = line.char()
//	if (c > '0' && c <= '9') {
//		num = line.get_int();
//		c = line.char()
//	} else {
//		num = 1
//	}
//	if (c == '/') {
//		den = 2;
//		c = line.next_char()
//		if (c == '/') {
//			do {
//				den *= 2;
//				c = line.next_char()
//			} while (c == '/')
//		} else if (c > '0' && c <= '9') {
//			den = line.get_int()
//		}
//	} else {
//		den = 1
//	}
	return [num, den]
}

// parse the note accidental and pitch
function parse_acc_pit(line) {
	var	acc, micro_n, micro_d, pit,
		c = line.char()

	// optional accidental
	switch (c) {
	case '^':
		c = line.next_char()
		if (c == '^') {
			acc = 2;
			c = line.next_char()
		} else {
			acc = 1
		}
		break
	case '=':
		acc = 3;
		c = line.next_char()
		break
	case '_':
		c = line.next_char()
		if (c == '_') {
			acc = -2;
			c = line.next_char()
		} else {
			acc = -1
		}
		break
	}

	/* look for microtone value */
	if (acc && (c >= '1' && c <= '9')
	 || c == '/') {				// compatibility
		nd = parse_dur(line);
		micro_n = nd[0];
		micro_d = nd[1]
		if (micro_d == 1)
			micro_d = curvoice.microscale
		else
			micro_d *= 2;	// 1/2 tone fraction -> tone fraction
		c = line.char()
	}

	/* get the pitch */
	pit = "CDEFGABcdefgab".indexOf(c) + 16;
	c = line.next_char()
	if (pit < 16) {
		line.error("'" + line.buffer[line.index - 1] + "' is not a note")
		return undefined
	}

	// octave
	while (c == "'") {
		pit += 7;
		c = line.next_char()
	}
	while (c == ',') {
		pit -= 7;
		c = line.next_char()
	}
	note = {
		pit: pit,
		apit: pit,
		shhd: 0,
		shac: 0,
		ti1: 0
	}
	if (acc) {
		note.acc = acc
		if (micro_n) {
			note.micro_n = micro_n;
			note.micro_d = micro_d
		}
	}
	return note
}

/* set the mapping of a note */
function set_map(note) {
	var	bn, an, nn, i,
		nmap,
		map = maps[curvoice.map]	// never null

	bn = 'abcdefg'[(note.pit + 77) % 7]
	if (note.acc)
		an = ['__', '_', '', '^', '^^', '='][note.acc + 2]
	else
		an = ''
//fixme: treat microtone
	nn = an + bn
	for (i = note.pit; i >= 28; i -= 7)
		nn += "'"
	for (i = note.pit; i < 21; i += 7)
		nn += ",";

	// direct mapping
	nmap = map[nn]
	if (nmap) {
		if (nmap[1]) {
			note.apit = note.pit = nmap[1].pit;	// print
			note.acc = nmap[1].acc
		}
	} else {
		nn = 'octave,' + an + bn		// octave
		if (!map[nn]) {
			nn = 'key,' +			// 'key,'
				'abcdefg'[(note.pit + 77 -
						curvoice.ckey.k_delta) % 7]
			if (!map[nn]) {
				nn = 'all'		// 'all,'
				if (!map[nn])
					return
			}
		}
	}
	note.map = map[nn]
}

/* -- parse note or rest with pitch and length -- */
// 'line' is not always 'parse.line'
function parse_basic_note(line, ulen) {
	var	nd,
		note = parse_acc_pit(line)

	if (!note)
		return null

	// duration
	if (line.char() == '0') {		// compatibility
		parse.stemless = true;
		line.advance()
	}
	nd = parse_dur(line);
	note.dur = ulen * nd[0] / nd[1]
	return note
}

function parse_vpos() {
	var	c,
		line = parse.line,
		ti1 = 0

	if (line.buffer[line.index - 1] == '.' && !a_dcn)
		ti1 = SL_DOTTED
	switch (line.next_char()) {
	case "'":
		line.index++;
		return ti1 + SL_ABOVE
	case ",":
		line.index++;
		return ti1 + SL_BELOW
	}
	return ti1 + SL_AUTO
}

const	cde2fcg = [0, 2, 4, -1, 1, 3, 5],
	cgd2cde = [0, 4, 1, 5, 2, 6, 3],
	acc2 = [-2, -1, 3, 1, 2]

/* transpose a note / chord */
function note_transp(s) {
	var	i, j, n, d, a, acc, i1, i3, i4, note,
		m = s.nhd,
		sf_old = curvoice.okey.k_sf,
		i2 = curvoice.ckey.k_sf - sf_old,
		dp = cgd2cde[(i2 + 4 * 7) % 7],
		t = curvoice.transpose

//	if (t > 0) {
//		dp += Math.floor(t / 3 / 12) * 7
//	} else {
//		if (dp != 0)
//			dp -= 7;
//		dp -= Math.floor(-t / 3 / 12) * 7
//	}
	if (t < 0 && dp != 0)
		dp -= 7;
	dp += ((t / 3 / 12) | 0) * 7
	for (i = 0; i <= m; i++) {
		note = s.notes[i];

		// pitch
		n = note.pit;
		note.pit += dp;
		note.apit = note.pit;

		// accidental
		i1 = cde2fcg[(n + 5 + 16 * 7) % 7];	/* fcgdaeb */
		a = note.acc
		if (!a) {
			if (!curvoice.okey.a_acc) {
				if (sf_old > 0) {
					if (i1 < sf_old - 1)
						a = 1	// sharp
				} else if (sf_old < 0) {
					if (i1 >= sf_old + 6)
						a = -1	// flat
				}
			} else {
				for (j = 0; j < curvoice.okey.a_acc.length; j++) {
					acc = curvoice.okey.a_acc[j]
					if ((n + 16 * 7 - acc.pit) % 7 == 0) {
						a = acc.acc
						break
					}
				}
			}
		}
		i3 = i1 + i2
		if (a && a != 3)				// ! natural
			i3 += a * 7;

//		i1 = (Math.floor((i3 + 1 + 21) / 7) + 2 - 3 + 32 * 5) % 5;
		i1 = ((((i3 + 1 + 21) / 7) | 0) + 2 - 3 + 32 * 5) % 5;
		a = acc2[i1]
		if (note.acc) {
			;
		} else if (curvoice.ckey.k_none) {
			if (a == 3		// natural
			 || acc_same_pitch(note.pit))
				continue
		} else if (curvoice.ckey.a_acc) {	/* acc list */
			i4 = cgd2cde[(i3 + 16 * 7) % 7]
			for (j = 0; j < curvoice.ckey.a_acc.length; j++) {
				if ((i4 + 16 * 7 - curvoice.ckey.a_acc[j].pits) % 7
							== 0)
					break
			}
			if (j < curvoice.ckey.a_acc.length)
				continue
		} else {
			continue
		}
		i1 = note.acc;
		d = note.micro_d
		if (d					/* microtone */
		 && i1 != a) {				/* different accidental type */
			n = note.micro_n
//fixme: double sharps/flats ?*/
//fixme: does not work in all cases (tied notes, previous accidental)
			switch (a) {
			case 3:			// natural
				if (n > d / 2) {
					n -= d / 2;
					note.micro_n = n;
					a = i1
				} else {
					a = -i1
				}
				break
			case 2:			// double sharp
				if (n > d / 2) {
					note.pit += 1;
					note.apit = note.pit;
					n -= d / 2
				} else {
					n += d / 2
				}
				a = i1;
				note.micro_n = n
				break
			case -2:		// double flat
				if (n >= d / 2) {
					note.pit -= 1;
					note.apit = note.pit;
					n -= d / 2
				} else {
					n += d / 2
				}
				a = i1;
				note.micro_n = n
				break
			}
		}
		note.acc = a
	}
}

/* sort the notes of the chord by pitch (lowest first) */
function sort_pitch(s) {
	function pitch_compare(n1, n2) {
		return n1.pit - n2.pit
	}

	s.notes = s.notes.sort(pitch_compare)
}
function new_note(grace, tuplet_fact) {
	var	note, s, in_chord, c, dcn,
		i, n, s2, nd, res, num, dur,
		sl1 = 0,
		line = parse.line,
		a_dcn_sav = a_dcn;	// save parsed decoration names

	a_dcn = null;
	parse.stemless = false;
	s = {
		type: NOTE,
		ctx: parse.ctx,
//temporary
//		istart: parse.istart,
		stem: 0,
		multi: 0,
		nhd: 0,
		xmx: 0
	}
//temporary
	s.istart = parse.bol + line.index

	if (grace) {
		s.grace = true
	} else {
		if (a_gch)
			gch_build(s)
	}
	c = line.char()
	switch (c) {
	case 'X':
		s.invis = true
	case 'Z':
		s.type = MREST;
		c = line.next_char()
		if (c > '0' && c <= '9')
			s.nmes = line.get_int()
		else
			s.nmes = 1;
		s.dur = curvoice.wmeasure * s.nmes

		// ignore if in second voice
		if (curvoice.second) {
			curvoice.time += s.dur
//			return s
			return null
		}
		break
	case 'y':
		s.type = SPACE;
		s.invis = true;
		c = line.next_char()
		if (c >= '0' && c <= '9')
			s.width = line.get_int()
		else
			s.width = 10
		break
	case 'x':
		s.invis = true
	case 'z':
		s.type = REST;
		line.advance()
		nd = parse_dur(line);
		s.dur = s.dur_orig = ((curvoice.ulen < 0) ? BASE_LEN / 4 :
					curvoice.ulen) * nd[0] / nd[1];
		s.notes = [{
			pit: 18,
			dur: s.dur
		}]
		break
	case '[':			// chord
		in_chord = true;
		c = line.next_char()
		// fall thru
	default:			// accidental, chord, note
		if (curvoice.microscale)
			s.microscale = curvoice.microscale;
		s.notes = []

		// loop on the chord
		while (1) {

			// when in chord, get the slurs and decorations
			if (in_chord) {
				while (1) {
					if (!c || c == '%')
						break
					i = c.charCodeAt(0);
					if (i >= 128) {
						line.error(not_ascii)
						return null
					}
					type = char_tb[i]
					switch (type[0]) {
					case '(':
						sl1 <<= 4;
						sl1 += parse_vpos();
						c = line.char()
						continue
					case '!':
						if (!a_dcn)
							a_dcn = []
						if (type.length > 1) {
							a_dcn.push(type.slice(1, -1))
						} else {
							dcn = ""
							while (1) {
								c = line.next_char()
								if (!c || c == '%') {
									line.error("No end of decoration")
									return null
								}
								if (c == '!')
									break
								dcn += c
							}
							a_dcn.push(dcn)
						}
						c = line.next_char()
						continue
					}
					break
				}
			}
			note = parse_basic_note(line,
					(s.grace || curvoice.ulen < 0) ?
						BASE_LEN / 4 : curvoice.ulen)
			if (!note)
				return null

			// transpose
			if (curvoice.octave)
				note.apit = note.pit += curvoice.octave * 7;
			if (sl1) {
				note.sl1 = sl1
				if (s.sl1)
					s.sl1++
				else
					s.sl1 = 1;
				sl1 = 0
			}
			if (a_dcn) {
				note.a_dcn = a_dcn;
				a_dcn = null
			}
			s.notes.push(note)
			if (!in_chord)
				break

			// in chord: get the ending slurs and the ties
			c = line.char()
			while (1) {
				switch (c) {
				case ')':
					if (note.sl2)
						note.sl2++
					else
						note.sl2 = 1
					if (s.sl2)
						s.sl2++
					else
						s.sl2 = 1;
					c = line.next_char()
					continue
				case '-':
					note.ti1 = parse_vpos();
					s.ti1 = true;
					c = line.char()
					continue
				case '.':
					c = line.next_char()
					if (c != '-') {
						line.error("Misplaced dot")
						break
					}
					continue
				}
				break
			}
			if (c == ']') {
				line.advance()

				// adjust the chord duration
				nd = parse_dur(line);
				s.nhd = s.notes.length - 1
				for (i = 0; i <= s.nhd ; i++) {
					note = s.notes[i];
					note.dur = note.dur * nd[0] / nd[1]
				}
				break
			}
		}

		// the duration of the chord is the duration of the 1st note
		s.dur = s.dur_orig = s.notes[0].dur

	}
	if (s.grace && s.type != NOTE) {
		line.error("Not a note in grace note sequence")
		return null
	}

	if (s.notes) {				// if note or rest
		if (s.type == NOTE && curvoice.transpose)
			note_transp(s)

		if (!s.grace) {
			switch (curvoice.pos.ste) {
			case SL_ABOVE: s.stem = 1; break
			case SL_BELOW: s.stem = -1; break
			}

			s.combine = curvoice.combine

			// adjust the symbol duration
			if (tuplet_fact)
				s.dur *= tuplet_fact;
			num = curvoice.brk_rhythm
			if (num) {
				curvoice.brk_rhythm = 0;
				s2 = curvoice.last_note
				if (num > 0) {
					n = num * 2 - 1;
					s.dur = s.dur * n / num;
					s.dur_orig = s.dur_orig * n / num
					for (i = 0; i <= s.nhd; i++)
						s.notes[i].dur =
							s.notes[i].dur * n / num;
					s2.dur /= num;
					s2.dur_orig /= num
					for (i = 0; i <= s2.nhd; i++)
						s2.notes[i].dur /= num
				} else {
					num = -num;
					n = num * 2 - 1;
					s.dur /= num;
					s.dur_orig /= num
					for (i = 0; i <= s.nhd; i++)
						s.notes[i].dur /= num;
					s2.dur = s2.dur * n / num;
					s2.dur_orig = s2.dur_orig * n / num
					for (i = 0; i <= s2.nhd; i++)
						s2.notes[i].dur =
							s2.notes[i].dur * n / num
				}
				curvoice.time = s2.time + s2.dur;
				res = identify_note(s2, s2.dur_orig);
				s2.head = res[0];
				s2.dots = res[1];
				s2.nflags = res[2]
				if (s2.nflags <= -2)
					s2.stemless = true
				else
					delete s2.stemless
			}
		} else {		/* grace note - adjust its duration */
			var div = curvoice.key.k_bagpipe ? 8 : 4

			for (i = 0; i <= s.nhd; i++)
				s.notes[i].dur /= div;
			s.dur /= div;
			s.dur_orig /= div
			switch (curvoice.pos.gst) {
			case SL_ABOVE: s.stem = 1; break
			case SL_BELOW: s.stem = -1; break
			case SL_HIDDEN:	s.stem = 2; break	/* opposite */
			}
		}

		// set the symbol parameters
		if (s.type == NOTE) {
			res = identify_note(s, s.dur_orig);
			s.head = res[0];
			s.dots = res[1];
			s.nflags = res[2]
			if (s.xstem)
				s.nflags = 0
			if (s.nflags <= -2)
				s.stemless = true
			if (curvoice.map
			 && maps[curvoice.map]) {
				for (i = 0; i <= s.nhd; i++)
					set_map(s.notes[i])
			}
//			if (s.nhd != 0)
//				sort_pitch(s)
		} else {					// rest

			/* change the figure of whole measure rests */
//--fixme: does not work in sample.abc because broken rhythm on measure bar
			dur = s.dur_orig
			if (dur == curvoice.wmeasure) {
				if (dur < BASE_LEN * 2)
					dur = BASE_LEN
				else if (dur < BASE_LEN * 4)
					dur = BASE_LEN * 2
				else
					dur = BASE_LEN * 4
			}
			res = identify_note(s, dur);
			s.head = res[0];
			s.dots = res[1];
			s.nflags = res[2]
		}
		curvoice.last_note = s
	}
	sym_link(s)

	if (cfmt.shiftunison)
		s.shiftunison = cfmt.shiftunison
	if (!curvoice.lyric_restart)
		curvoice.lyric_restart = s

//	if (curvoice.clef.clef_type == 'p')
//		s.perc = true

	if (a_dcn_sav)
		deco_cnv(a_dcn_sav, s, s.prev)
	if (parse.stemless)
		s.stemless = true
//temporary
//	s.iend = parse.iend
	s.iend = parse.bol + line.index
	return s
}

// characters in the music line (ASCII only)
const nil = ["0"]
var char_tb = [
	nil, nil, nil, nil,		/* 00 - .. */
	nil, nil, nil, nil,
	nil, " ", "\n", nil,		/* . \t \n . */
	nil, nil, nil, nil,
	nil, nil, nil, nil,
	nil, nil, nil, nil,
	nil, nil, nil, nil,
	nil, nil, nil, nil,		/* .. - 1f */
	" ", "!", '"', nil,		/* (sp) ! " # */
	"\n", nil, "&", nil,		/* $ % & ' */
	"(", ")", nil, nil,		/* ( ) * + */
	nil, "-", "!dot!", nil,		/* , - . / */
	nil, nil, nil, nil, 		/* 0 1 2 3 */
	nil, nil, nil, nil, 		/* 4 5 6 7 */
	nil, nil, "|", nil,		/* 8 9 : ; */
	"<", "n", "<", nil,		/* < = > ? */
	nil, "n", "n", "n",		/* @ A B C */
	"n", "n", "n", "n", 		/* D E F G */
	"!fermata!", "d", "d", "d",	/* H I J K */
	"!emphasis!", "!lowermordent!",
		"d", "!coda!",		/* L M N O */
	"!uppermordent!", "d",
		"d", "!segno!",		/* P Q R S */
	"!trill!", "d", "d", "d",	/* T U V W */
	"n", "d", "n", "[",		/* X Y Z [ */
	"\\","|", "n", "n",		/* \ ] ^ _ */
	"i", "n", "n", "n",	 	/* ` a b c */
	"n", "n", "n", "n",	 	/* d e f g */
	"d", "d", "d", "d",		/* h i j k */
	"d", "d", "d", "d",		/* l m n o */
	"d", "d", "d", "d",		/* p q r s */
	"d", "!upbow!",
		"!downbow!", "d",	/* t u v w */
	"n", "n", "n", "{",		/* x y z { */
	"|", "}", "!roll!", nil,	/* | } ~ (del) */
]

function parse_music_line() {
	var	s, grace, sappo, dcn, i, c, idx, type, n, text,
		last_note_sav, a_dcn_sav, no_eol,
		s_tuplet, s_tuplet_up, tuplet_fact_up,
		tuplet_fact = 1,
		slur_start = 0
//temporary
 var line = parse.line;
 line.buffer = parse.file.slice(parse.bol, parse.eol);
 line.index = 0;

	while (1) {
		c = line.char()
		if (!c || c == '%')
			break

		// special case for '.' (dot)
		if (c == '.') {
			switch (line.buffer[line.index + 1]) {
			case '(':
			case '-':
			case '|':
				c = line.next_char()
				break
			}
		}

		idx = c.charCodeAt(0);
		if (idx >= 128) {
			line.error(not_ascii);
			line.advance()
			continue
		}
		type = char_tb[idx]
		switch (type[0]) {
		case ' ':			// beam break
			s = curvoice.last_note
			if (s) {
				s.beam_end = true
				if (grace)
					s.gr_shift = true
			}
			break
		case '\n':			// line break
			if (cfmt.barsperstaff)
				break
			if (par_sy.voices[curvoice.v].range == 0
			 && curvoice.last_sym)
				curvoice.last_sym.eoln = true
			break
		case '&':			// voice overlay
			c = line.next_char()
			if (c == ')') {
				get_vover(')')
				break
			}
			get_vover('&')
			continue
		case '(':			// slur start - tuplet - vover
			c = line.next_char()
			if (c > '0' && c <= '9') {	// tuplet
				var	pplet = line.get_int(),
					qplet = [0, 1, 3, 2, 3, 0, 2, 0, 3, 0][pplet],
					rplet = pplet,
					c = line.char()

				if (c == ':') {
					c = line.next_char()
					if (c > '0' && c <= '9') {
						qplet = line.get_int();
						c = line.char()
					}
					if (c == ':') {
						c = line.next_char()
						if (c > '0' && c <= '9') {
							rplet = line.get_int();
							c = line.char()
						} else {
							line.error("Invalid 'r' in tuplet")
							continue
						}
					}
				} else {
					if (qplet == 0)
						qplet = (curvoice.wmeasure
								% 9) == 0 ?
									3 : 2
				}
				s = {
					type: TUPLET,
					tuplet_p: pplet,
					tuplet_q: qplet,
					tuplet_r: rplet,
					tuplet_n: rplet,
					tuplet_f: clone(cfmt.tuplets)
				}
				sym_link(s);
				s_tuplet_up = s_tuplet;
				tuplet_fact_up = tuplet_fact;
				s_tuplet = s;
				tuplet_fact *= qplet / pplet
				continue
			}
			if (c == '&') {		// voice overlay start
				get_vover('(')
				break
			}
			slur_start <<= 4;
			line.index--;
			slur_start += parse_vpos()
			continue
		case ')':			// slur end
			if (curvoice.ignore)
				break
			s = curvoice.last_sym
			if (s) {
				switch (s.type) {
				case NOTE:
				case REST:
				case SPACE:
					break
				default:
					s = null
					break
				}
			}
			if (!s) {
				line.error("Bad character ')'")
				break
			}
			if (s.slur_end)
				s.slur_end++
			else
				s.slur_end = 1
			break
		case '!':			// start of decoration
			if (!a_dcn)
				a_dcn = []
			if (type.length > 1) {	// decoration letter
				a_dcn.push(type.slice(1, -1))
				break
			}
			dcn = "";
			i = line.index		// in case no deco end
			while (1) {
				c = line.next_char()
				if (c == '%')
					c = 0
				if (!c)
					break
				if (c == '!')
					break
				dcn += c
			}
			if (!c) {
				line.index = i;
				line.error("No end of decoration")
				break
			}
			a_dcn.push(dcn)
			break
		case '"':
			parse_gchord(type)
			break
		case '-':
			var tie_pos = 0

			if (!curvoice.last_note
			 || curvoice.last_note.type != NOTE) {
				line.error("No note before '-'")
				break
			}
			tie_pos = parse_vpos();
			s = curvoice.last_note
			for (i = 0; i <= s.nhd; i++) {
				if (!s.notes[i].ti1)
					s.notes[i].ti1 = tie_pos
				else if (s.nhd == 0)
					line.error("Too many ties")
			}
			s.ti1 = true
			continue
		case '[':
			var c_next = line.buffer[line.index + 1]

			if ('|[]: "'.indexOf(c_next) >= 0
			 || (c_next >= '1' && c_next <= '9')) {
				if (grace) {
					line.error("Cannot have a bar in grace notes")
					break
				}
				new_bar()
				continue
			}
			if (line.buffer[line.index + 2] == ':') {
//temporary
				parse.istart = parse.bol + line.index;
				line.index++;
//fixme: KO if no end of info and '%' followed by ']'
				i = line.buffer.indexOf(']', line.index);
				if (i < 0) {
					line.error("Lack of ']'")
					break
				}
				text = line.buffer.slice(line.index + 2, i).trim()

				line.index = i + 1;
//temporary
				parse.iend = parse.bol + line.index
				var err = do_info(c_next, text)

				if (err)
					line.error(err);
				continue
			}
			// fall thru ('[' is start of chord)
		case 'n':				// note/rest
			s = new_note(grace, tuplet_fact)
			if (!s)
				continue;
			if (s.type == NOTE) {
				s.slur_start = slur_start;
				slur_start = 0
				if (sappo) {
					s.sappo = true;
					sappo = false
				}
			}
			if (grace) {
				if (s_tuplet)
					s.in_tuplet = true
			} else if (s_tuplet && s.notes) {
				s.in_tuplet = true;
				s_tuplet.tuplet_n--
				if (s_tuplet_up)
					s_tuplet_up.tuplet_n--
				if (s_tuplet.tuplet_n == 0) {
					s_tuplet = s_tuplet_up;
					tuplet_fact = tuplet_fact_up
					if (s_tuplet) {
						s_tuplet_up = null;
						tuplet_fact_up = 1
						if (s_tuplet.tuplet_n == 0) {
							s_tuplet = null;
							tuplet_fact = 1;
							curvoice.time = Math.round(curvoice.time);
							s.dur = curvoice.time - s.time
						}
					} else {
						curvoice.time = Math.round(curvoice.time);
						s.dur = curvoice.time - s.time
					}
				}
			}
			continue
		case '<':				/* '<' and '>' */
			if (!curvoice.last_note) {
				line.error("No note before '<'")
				break
			}
			n = c == '<' ? 1 : -1
			while (c == '<' || c == '>') {
				n *= 2;
				c = line.next_char()
			}
			curvoice.brk_rhythm = n
			continue
//		case 'd':				// possible decoration
//			line.error("Bad character '" + c + "'")
//			break
		case 'i':				// ignore
			break
		case '{':
//fixme: create GRACE and link in 'extra'
			if (grace) {
				line.error("'{' in grace note")
				break
			}
			last_note_sav = curvoice.last_note;
			curvoice.last_note = null;
			a_dcn_sav = a_dcn;
			a_dcn = undefined;
			grace = true;
			c = line.next_char()
			if (c == '/') {
				sappo = true
				break
			}
			continue
		case '|':
			c = line.buffer[line.index - 1];
			new_bar()
			if (c == '.')
				curvoice.last_sym.bar_dotted = true
			continue
		case '}':
			s = curvoice.last_note
			if (!grace || !s) {
				line.error("Bad character '}'")
				break
			}
			if (a_dcn)
				line.error("Decoration ignored");
			s.gr_end = true;
			grace = false
			if ((!s.prev
			  || !s.prev.grace)		// if one grace note
			 && !curvoice.key.k_bagpipe) {
				for (i = 0; i <= s.nhd; i++)
					s.notes[i].dur *= 2;
				s.dur *= 2;
				s.dur_orig *= 2
				var res = identify_note(s, s.dur_orig);
				s.head = res[0];
				s.dots = res[1];
				s.nflags = res[2]
			}
			curvoice.last_note = last_note_sav;
			a_dcn = a_dcn_sav
			break
		case "\\":
//			if (line.index == line.buffer.length - 1)
//				return
			for (i = line.index + 1; ; i++) {
				switch (line.buffer[i]) {
				case ' ':
				case '\t':
					continue
				case '%':
					line.index = line.buffer.length;
				case undefined:
					c = undefined;
					no_eol = true
					break
				}
				break
					
			}
			if (!c)
				break
			// fall thru
		default:
			line.error("Bad character '$1'", c)
			break
		}
		line.advance()
	}

	if (s_tuplet)
		line.error("No end of tuplet")
	if (grace)
		line.error("No end of grace note sequence")
	if (cfmt.breakoneoln && curvoice.last_note)
		curvoice.last_note.beam_end = true
	if (no_eol || cfmt.barsperstaff)
		return
	if (char_tb['\n'.charCodeAt(0)] == '\n'
	 && par_sy.voices[curvoice.v].range == 0
	 && curvoice.last_sym)
		curvoice.last_sym.eoln = true
//--fixme: cfmt.alignbars
}
