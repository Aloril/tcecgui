// global.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2020-07-21
//
// global variables/functions shared across multiple js files
//
// included after: common, engine
/*
globals
Abs, Assign, Atan, Clamp, DEV:true, Exp, exports, Floor, global, IsArray, Keys, location, LS, Max, Min, Pad, Pow,
require, Round, save_option, Split, Undefined, window, X_SETTINGS, Y
*/
'use strict';

// <<
if (typeof global != 'undefined') {
    let req = require,
        {Assign} = req('./common');
    Assign(global, {
        Assign: Assign,
    });
}
// >>

// modify those values in config.js
let HOST_ARCHIVE,
    LINKS = {},
    LOCALHOST = (location.port == 8080),
    SF_COEFF_AS = [-8.24404295, 64.23892342, -95.73056462, 153.86478679],
    SF_COEFF_BS = [-3.37154371, 28.44489198, -56.67657741,  72.05858751],
    SF_PAWN_VALUE = 2.06,
    TIMEOUTS = {
        adblock: 15 * 1000,
        banner: 30 * 1000,
        google_ad: -1,                  // disabled
        graph: 1 * 1000,
        tables: 3 * 1000,
        three: 1 * 1000,                // 3d scene
        twitch: 5 * 1000,
        users: 5 * 1000,
    },
    VERSION = '20200721';

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Convert centipawn to score % for AS
 * @see https://github.com/manyoso/allie/blob/be656ec3042e0422c8275d6362ca4f69b2e43f0d/lib/node.cpp#L39
 * @param {number} cp
 * @returns {number}
 */
function allie_cp_to_score(cp) {
    if (Abs(cp) > 1000)
        return (cp + (cp > 0 ? 127407 : -127407)) / 153007;
    return Atan(cp / 111) / 1.74;
}

/**
 * Calculate the probability to draw or win
 * - works for AA and NN engines
 * @param {string} short_engine short engine name
 * @param {number} eval_
 * @param {number} ply
 * @returns {number} q %
 */
function calculate_feature_q(feature, eval_, ply) {
    let white_win;

    if (feature & 1) {
        let cp = eval_ * 100;
        if (feature & 2)
            white_win = leela_cp_to_score(cp);
        else if (feature & 4)
            white_win = allie_cp_to_score(cp);
        else if (feature & 8)
            white_win = stoof_cp_to_score(cp);
        else
            white_win = (Atan((eval_ * 100) / 290.680623072) / 3.096181612 + 0.5) * 2 - 1;

        // this is the HALF white win %
        white_win *= 50;
    }
    else if (ply >= 0) {
        let wdl = stockfish_wdl(eval_ * 100, ply);
        white_win = (wdl[0] - wdl[2]) / 20;
    }
    else
        white_win = (50 - (100 / (1 + Pow(10, eval_/ 4))));

    return white_win;
}

/**
 * Fix old move format from Season 1
 * @param {Move} move
 */
function fix_move_format(move) {
    if (move._fixed || move.book)
        return;

    // fix eval
    if (move.wv == undefined)
        move.wv = move.ev;

    // fix move time
    if (isNaN(move.mt) && move.mt)
        move.mt = parse_time(move.mt) * 1000;

    // fix time left
    if (isNaN(move.tl) && move.tl)
        move.tl = parse_time(move.tl) * 1000;

    // fix speed
    if (isNaN(move.s) && move.s) {
        let items = move.s.split(' ');
        if (items.length >= 2)
            move.s = parseFloat(items[0]) * ({k: 1000, M: 1e6}[items[1][0]] || 1);
    }

    // fix nodes
    // note: it's an approximation, not reliable at low values => skipped there
    if (move.n == undefined && move.mt >= 2000)
        move.n = Floor(move.s / move.mt * 1000 + 0.5);

    // fix too fast speed: > 10Bnps
    if (move.s > 1e10) {
        move.n = '-';
        move.s = '-';
    }
    else if (move.n) {
        // fix missing speed
        if (!move.s)
            move.s = (move.mt >= 2000)? Floor(move.n / move.mt * 1000): '-';
        // fix insta-moves speed
        else if (move.mt && move.mt < 2000) {
            let speed = move.n / (move.mt + 500) * 1000;
            if (move.s > speed * 3)
                move.s = '-';
        }
    }

    move._fixed = true;
}

/**
 * Get the ply from the FEN
 * @param {string} fen
 */
function get_fen_ply(fen) {
    let items = fen.split(' ');
    return (items[5] - 1) * 2 - (items[1] == 'w') * 1;
}

/**
 * Get the move ply, either directly or by looking at the FEN
 * - also update move.ply
 * @param {Move} move
 * @returns {number} ply -2 on error, -1 on the initial position, otherwise >= 0
 */
function get_move_ply(move) {
    if (!move)
        return -2;
    if (move.ply != undefined)
        return move.ply;
    if (!move.fen)
        return -2;

    let ply = get_fen_ply(move.fen);
    if (ply >= -1) {
        move.ply = ply;
        return ply;
    }
    return -2;
}

/**
 * Convert centipawn to score % for Leela 2019+
 * @see https://github.com/LeelaChessZero/lc0/pull/1193/files
 * @param {number} cp
 * @returns {number}
 */
function leela_cp_to_score(cp) {
    return Atan(cp / 90) / 1.5637541897;
}

/**
 * Mix 2 hex colors
 * @param {string} color1 #ffff00, ffff00
 * @param {string} color2 #0000ff
 * @param {number} mix how much of color2 to use, 0..1
 * @returns {string} #808080
 */
function mix_hex_colors(color1, color2, mix) {
    if (mix <= 0)
        return color1;
    else if (mix >= 1)
        return color2;

    let off1 = (color1[0] == '#')? 1: 0,
        off2 = (color2[0] == '#')? 1: 0;

    return '#' + [0, 2, 4].map(i => {
        let color =
              parseInt(color1.slice(off1 + i, off1 + i + 2), 16) * (1 - mix)
            + parseInt(color2.slice(off2 + i, off2 + i + 2), 16) * mix;
        return Pad(Round(color).toString(16));
    }).join('');
}

/**
 * Parse DEV
 */
function parse_dev() {
    let names = {
            a: 'arrow',
            A: 'ad',                    // disable ads (for development)
            b: 'board',
            c: 'chart',
            C: 'cup',                   // force loading bracket.json
            d: 'debug',
            D: 'div',
            e: 'eval',                  // live eval
            E: 'engine',
            f: 'fen',                   // parse_fen
            g: 'graph',
            G: 'global',
            i: 'input',                 // gamepad input
            j: 'json',                  // static json files
            l: 'load',
            m: 'mobil',
            o: 'open',
            n: 'new',                   // new game debugging
            p: 'pv',
            P: 'popup',                 // disable popups
            q: 'queue',
            s: 'socket',                // socket messages
            S: 'no_socket',
            T: 'translate',             // gather translations
            u: 'ui',                    // UI events
            w: 'wasm',
            y: 'ply',
        },
        text = Y.dev || '';

    DEV = {};
    for (let i = 0, length = text.length; i < length; i ++) {
        let letter = text[i];
        if (letter == 'Z')
            DEV = {};
        else {
            let name = names[letter];
            if (name)
                DEV[name] = 1;
        }
    }

    if (DEV.debug)
        LS(DEV);
    window.DEV = DEV;
}

/**
 * Get the seconds from a time text
 * @param {string} text
 * @returns {number}
 */
function parse_time(time) {
    if (!time)
        return 0;
    let [hour, min, sec] = time.split(':');
    return hour * 3600 + min * 60 + sec * 1;
}

/**
 * Reset some settings if the version is too old
 */
function reset_old_settings() {
    let version = Undefined(Y.version, '');
    if (version == VERSION)
        return;

    if (!version) {
        let updates = ['audio'];
        for (let update of updates) {
            let settings = X_SETTINGS[update];
            if (!settings)
                continue;
            LS(`reset ${update} settings ...`);

            Keys(settings).forEach(key => {
                let value = settings[key];
                if (IsArray(value))
                    save_option(key, value[1]);
            });
        }
    }

    if (version < '20200530') {
        save_option('archive_scroll', 1);
        save_option('wheel_adjust', 63);
    }
    if (version < '20200603' && Y.panel_gap < 8)
        save_option('panel_gap', 8);
    if (version < '20200605')
        if (Y.scroll_inertia < 0.95)
            save_option('scroll_inertia', 0.95);

    LS(`version: ${version} => ${VERSION}`);
    save_option('version', VERSION);
    Y.new_version = true;
}

/**
 * Split a PV string into ply + array of strings
 * @param {string} text
 * @returns {[number, string[]]}
 */
function split_move_string(text) {
    if (!text)
        return [-2, []];

    let items = text.replace(/[.]{2,}/, ' ... ').split(' '),
        ply = (parseInt(items[0]) - 1) * 2 + (items[1] == '...'? 1: 0);
    return [ply, items];
}

/**
 * Function from ply and centipawns to vector of outcome ‰ for Stockfish
 * @see https://github.com/official-stockfish/Stockfish/pull/2778
 * @param {number} cp
 * @param {number} ply
 * @returns {number[]} w,d,l
 */
function stockfish_wdl(cp, ply) {
    let win = stockfish_win_rate_model(cp, ply),
        loss = stockfish_win_rate_model(-cp, ply),
        draw = Max(0, 1000 - win - loss);

    return [win, draw, loss];
}

/**
 * Function from ply and centipawns to win percentage for Stockfish
 * Serves as a helper function for sf_wdl_statistics.
 * A near 1:1 port of Joost VandeVondele's Stockfish WDL statistics
 * @see https://github.com/official-stockfish/Stockfish/pull/2778
 * @param {number} cp
 * @param {number} ply
 * @returns {number}
 */
function stockfish_win_rate_model(cp, ply) {
    let as = SF_COEFF_AS,
        bs = SF_COEFF_BS,
        m = Min(240, ply) / 64,
        a = (((as[0] * m + as[1]) * m + as[2]) * m) + as[3],
        b = (((bs[0] * m + bs[1]) * m + bs[2]) * m) + bs[3],
        v = cp * SF_PAWN_VALUE,
        x = Clamp(v / SF_PAWN_VALUE, -1000, 1000);

    return Floor(0.5 + 1000 / (1 + Exp((a - x) / b)));
}

/**
 * Convert centipawn to score % for Stoofvlees II
 * @param {number} cp
 * @returns {number}
 */
function stoof_cp_to_score(cp) {
    return Atan(cp / 194) / 1.55564;
}

// <<
if (typeof exports != 'undefined')
    Assign(exports, {
        fix_move_format: fix_move_format,
        get_move_ply: get_move_ply,
    });
// >>
