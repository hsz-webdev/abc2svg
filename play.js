//#javascript
// play-1.js file to include in html pages with abc2svg-1.js for playing
//
// Copyright (C) 2015-2016 Jean-Francois Moine
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License version 2 as
// published by the Free Software Foundation.

// AbcPlay creation
function AbcPlay(i_onend) {

	// -- global --
	var	onend = i_onend,	// callback function on play end
		ac,			// audio context
		gain,			// global gain
		a_e,			// event array
		o_vol = 0.2		// oscillator volume(s)

	// -- play the memorized events --
	var	evt_idx,		// event index while playing
		iend,			// source stop index
		ctime,			// current playing time
		a_g = []		// pool of free gains for oscillators

	function o_end(o, g) {		// oscillator end playing
		a_g.push(g);		// move the gain to the pool
		o.disconnect()
	}

	function play_next() {			// play the next time sequence
		var	t, ct, e, e2

		function play_note(f, d) { // play a note (freq, duration in seconds)
			var	o = ac.createOscillator(),
				g = a_g.pop()

			if (!g) {
				g = ac.createGain();
				g.gain.value = o_vol;
//				g.gain.value = 0.2;
				g.connect(gain)
			}

			o.frequency.value = f;
			o.type = "sine";
//			o.type = "triangle";
			o.onended = function() { o_end(o, g) }
//fixme
if (d > 0.8)
 d -= 0.07
else
 d *= 0.9
			o.start(ctime);
			o.stop(ctime + d);
			o.connect(g)
		}

		// play the next events
		e = a_e[evt_idx++]
		if (!e
		 || e[0] > iend) {		// if source ref > source end
			if (onend)
				onend()
			return
		}
		ct = e[1]			// time to play
		while (1) {
			play_note(e[2], e[3])	// freq, duration
			e2 = a_e[evt_idx]
			if (!e2) {
				t = ct + e[3]	// duration
				break
			}
			e = e2;
			t = e[1]		// time
			if (t != ct)
				break		// next time
			evt_idx++
		}
		ctime += t - ct;
		setTimeout(play_next, (ctime - ac.currentTime) * 1000 - 100)
	}

	this.play = function(istart, i_iend) {	// play the events
		if (!a_e)
			return			// no error? - ugly!
		iend = i_iend;
		evt_idx = 0
		while (a_e[evt_idx] && a_e[evt_idx][0] < istart)
			evt_idx++
		if (a_e[evt_idx])
			ctime = ac.currentTime + a_e[evt_idx][1];
		play_next()
	}
	this.stop = function() {		// stop playing
		iend = 0
	}
	this.set_g_vol = function(v) {		// set global volume
		gain.gain.value = v
	}
	this.set_o_vol = function(v) {		// set oscillator volume
		o_vol = v
		for (var i = 0; i < a_g.length; i++)
			a_g[i].gain.value = v
	}

	// -- generation of the playing events --
	var	p_time,				// last playing time
		abc_time,			// last ABC time
		play_factor			// play time factor

	this.clear = function() {		// clear all playing events
		a_e = null
	}

	this.add = function(s, k) {		// add playing events from the schema
						//	s: starting symbol
						//	k: starting key (first voice)
		// constants from Abc
		const	BAR = 0,
			GRACE = 4,
			KEY = 5,
			NOTE = 8,
			TEMPO = 14,
			BASE_LEN = 1536,
			scale = [0, 2, 4, 5, 7, 9, 11]	// note to pitch

		var	bmap = [],		// measure base map
			map = [],		// current map - 10 octaves
			i, n, dt, d, g,
			rep_st_i,		// repeat start index
			rep_st_t,		// and time
			rep_en_i,		// repeat stop index
			rep_en_t,		// and time
			rep_en_map = []		// and accidentals

		function key_map(s) {			// define the note map
			for (var i = 0; i < 7; i++)
				bmap[i] = 0
			switch (s.k_sf) {
			case 7: bmap[6] = 1
			case 6: bmap[2] = 1
			case 5: bmap[5] = 1
			case 4: bmap[1] = 1
			case 3: bmap[4] = 1
			case 2: bmap[0] = 1
			case 1: bmap[3] = 1; break
			case -7: bmap[3] = -1
			case -6: bmap[0] = -1
			case -5: bmap[4] = -1
			case -4: bmap[1] = -1
			case -3: bmap[5] = -1
			case -2: bmap[2] = -1
			case -1: bmap[6] = -1; break
			}
			bar_map()
		} // key_map

		function bar_map() {			// re-initialize the map on bar
			for (var j = 0; j < 10; j++)
				for (var i = 0; i < 7; i++)
					map[j * 7 + i] = bmap[i]
		} // bar_map

		function pit2f(s, i) {			// convert ABC pitch to frequency
			var	p = s.notes[i].apit + 19,	// pitch from lowest C
				a = s.notes[i].acc

			if (a)
				map[p] = a == 3 ? 0 : a;	// (3 = '=')
			p = Math.floor(p / 7) * 12 + scale[p % 7] + map[p]
			return 440 * Math.pow(2, (p - 69) / 12)
		} // pit2f

		function play_dup(s) {
			var i, n, en_t, dt, e;

			dt = p_time - rep_st_t
			for (i = rep_st_i; i < rep_en_i; i++) {
				e = a_e[i];
				a_e.push([e[0],
					e[1] + dt,
					e[2],
					e[3]])
			}
		} // play_dup

		function do_tie(s, i, d) {			// handle the ties
			var	j, n, s2, pit,
				note = s.notes[i],
				tie = note.ti1,
				end_time

			pit = note.apit;			// absolute pitch
			end_time = s.time + s.dur
			for (s2 = s.next; ; s2 = s2.next) {
				if (!s2
				 || s2.time != end_time)
					return d
				if (s2.type == NOTE)
					break
			}
			n = s2.notes.length
			for (j = 0; j < n; j++) {
				note = s2.notes[j]
				if (note.apit == pit) {
					d += s2.dur / play_factor;
					note.ti2 = true;
					return note.ti1 ? do_tie(s2, j, d) : d
				}
			}
			return d
		} // do_tie

		// add playing events
		key_map(k)				// init acc. map from key sig.

		if (!a_e) {				// first call
			a_e = []
			abc_time = rep_st_t = 0;
			p_time = 0;
			rep_st_i = rep_en_i = 0;
			play_factor = BASE_LEN / 4 * 80 / 60	// default: Q:1/4=80
		} else if (s.time < abc_time) {
			abc_time = rep_st_t = s.time;
		}
		while (s) {
			for (g = s.extra; g; g = g.next) {
				if (g.type == TEMPO
				 && g.tempo) {
					d = 0;
					n = g.tempo_notes.length
					for (i = 0; i < n; i++)
						d += g.tempo_notes[i];
					play_factor = d * g.tempo / 60
				}
			}

			dt = s.time - abc_time
			if (dt > 0) {
				p_time += dt / play_factor;
				abc_time = s.time
			}

			switch (s.type) {
			case BAR:
//fixme: handle different keys per staff
				if (s.st != 0)
					break
//fixme: handle the ties on repeat
				// left repeat
				if (s.bar_type[s.bar_type.length - 1] == ':') {
					rep_st_i = a_e.length;
					rep_st_t = p_time;
					rep_en_i = 0;
					rep_en_t = 0

				// 1st time repeat
				} else if (s.text && s.text[0] == '1') {
					rep_en_i = a_e.length;
					rep_en_t = p_time;
					bar_map()
					for (i = 0; i < 7; i++)
						rep_en_map[i] = bmap[i]
					break

				// right repeat
				} else if (s.bar_type[0] == ':') {
					if (rep_en_i == 0) {
						rep_en_i = a_e.length;
						rep_en_t = p_time
					} else {
						for (i = 0; i < 7; i++)
							bmap[i] = rep_en_map[i]
					}
					play_dup(s)
					p_time += rep_en_t - rep_st_t
				}

				bar_map()
				break
//			case GRACE:
//				break
			case KEY:
//fixme: handle different keys per staff
				if (s.st != 0)
					break
				key_map(s)
				break
			case NOTE:
				d = s.dur / play_factor
				for (i = 0; i <= s.nhd; i++) {
					if (s.notes[i].ti2) {
						s.notes[i].ti2 = false
						continue
					}
					a_e.push([s.istart,
						p_time,
						pit2f(s, i),
						s.notes[i].ti1 ? do_tie(s, i, d) : d])
				}
				break
			}
			s = s.ts_next
		}
	}

	// AbcPlay object creation
	if (window.AudioContext)
		ac = new window.AudioContext
	else if (window.webkitAudioContext)
		ac = new window.webkitAudioContext
	else
		return {}

	// create the global gain
	gain = ac.createGain();
	gain.gain.value = 0.7
  if (1) {
	gain.connect(ac.destination)
  } else {
	comp = ac.createDynamicsCompressor();
	comp.ratio = 16;
	comp.attack = 0.0005;
	comp.connect(ac.destination);
	gain.connect(comp)
  }
} // end AbcPlay
