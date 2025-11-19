function json_escape(str) {
    gsub(/\\/, "\\\\", str);
    gsub(/"/, "", str);
    gsub(/%20%/, " ", str);
    return str;
}
function json_val(str){
    return str ~ /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]{1,6})?$/ ? str : "\"\"" json_escape(str) "\"\""
}
function escape(str){
    gsub(/"/, """", str);
    return str;
}

BEGIN {
    if (length(tagfilter) > 0){
        tagsconds[1,1] = ""
        geomfilter = ""
        split(tagfilter, tagsands, /&/);
        for (i in tagsands){
            split(tagsands[i], tagsor, / /)
            for (j in tagsor){
                if (tagsor[j] ~ /\//){
                    split(tagsor[j], cond, /\//);
                    geomfilter = "^[" cond[1] "]+$" ;
                    tagsor[j] = cond[2];
                }
                if (tagsor[j] ~ /\!=/){
                    # Only ERE regexp in awk, no support of negative lookahead
                    tagsconds[i,j] = "^$"
                }else if (tagsor[j] ~ /=/){
                    split(tagsor[j], cond, /=/);
                    if (cond[2] ~ /,/){
                        gsub(/,/, "|", cond[2]);
                        cond[2] = "(" cond[2] ")"
                    }
                    gsub(/\*/, "[^\"]*", cond[1]);
                    gsub(/\*/, "[^\"]*", cond[2]);
                    tagsconds[i,j] = "^\"" cond[1] "\":\"" cond[2] "\"$"
                }else{
                    gsub(/\*/, "[^\"]*", tagsor[j]);
                    tagsconds[i,j] = "^\"" tagsor[j] "\":\".*\"$"
                }
            }
        }
    }

    features["n"] = "node"
    features["w"] = "way"
    features["r"] = "relation"

    # Force to write file to avoid error on psql import
    printf "" >> output_main
    if (length(output_members) > 0){
        printf "" >> output_members
    }
    if (length(output_users) > 0){
        printf "" >> output_users
    }
}

{
    f = substr($1, 1, 1);          # Feature
    fi = substr($1, 2);            # Feature id
    v = substr($2, 2);             # Version
    cs = substr($4, 2);            # Changeset
    d = substr($3, 2);             # Visibilité
    t = substr($5, 2);             # Timestamp
    w = substr($6, 2);             # User ID
    u = escape(substr($7, 2));     # User name
    T = substr($8, 2);             # Tags
    g = "";                        # Geometry
    c = "";                        # Contrib

    # Transformations
    if (v == "1"){
        a = "create"
        c = "add"
    }else if (v != "1" && d == "V"){
        a = "modify"
        c = "edit"
    }else {
        a = "delete"
        c = "delete"
    }

    # Validation du filtre sur la geometrie
    tagfilter_r = 0
    if (length(tagfilter) > 0){
        tagfilter_r = (length(geomfilter) == 0 ? 1 : f ~ geomfilter)
        for (i in tagsconds) {
            results[i] = false
        }
    }

    if (f == "n"){
        if (a != "delete"){
            x = substr($9, 2);     # Longitude
            y = substr($10, 2);    # Latitude
            g = "SRID=4326; POINT("x" "y")"
        }
    } else if (f == "w"){
        if (a != "delete" && length(output_members) > 0){
            N = substr($9, 2);
            n=split(N, Nlist, /,/)
            for (j=1 ; j<=n ; j++){
                printf "%s/%s,%s/%s,%s,%s,\n",
                    features[substr(Nlist[j], 1, 1)], substr(Nlist[j], 2), features[f], fi, v, j >> output_members
            }
        }
    } else if (f == "r"){
        if (a != "delete" && length(output_members) > 0){
            M = substr($9, 2);
            n=split(M, Mlist, /,/)
            for (j=1 ; j<=n ; j++){
                split(Mlist[j], member, /@/)
                printf "%s/%s,%s/%s,%s,,%s\n",
                    features[substr(member[1], 1, 1)], substr(member[1], 2), features[f], fi, v, member[2] >> output_members
            }
        }
    }

    n=split(T, tag_pairs, /,/);
    tagsjson = "";
    for (j=1 ; j<=n ; j++){
        split(tag_pairs[j], kv, /=/);
        li=split(kv[2], valitems, /;/);
        tagval=json_val(kv[2])
        if (li > 1){
            tagval = "["
            for (liidx in valitems){
                if (length(valitems[liidx]) > 0){
                    tagval = tagval (tagval == "[" ? "" : ",") json_val(valitems[liidx])
                }
            }
            tagval = tagval "]"
        }
        tagsjson = (j > 1 ? tagsjson "," : "") "\"\"" json_escape(kv[1]) "\"\":" tagval;

        if (length(tagfilter) > 0){
            tag_str = "\"" kv[1] "\":\"" kv[2] "\""
            for (i in tagsconds) {
                results[i] = results[i] || tag_str ~ tagsconds[i]
            }
        }
    }

    # Validation du filtre sur les tags
    if (length(tagfilter) > 0 && tagfilter_r){
        for (i in results){
            split(i, indices, SUBSEP)
            localresult[indices[1]] = indices[2] == 1 ? results[i] : localresult[indices[1]] || results[i]
        }
        for (i in localresult){
            tagfilter_r = tagfilter_r && localresult[i]
        }
    }

    # Construction de la sortie contributeurs
    if (length(output_users) > 0){
        printf "%s,%s\n",
           u, w >> output_users
    }

    # Construction de la sortie CSV principale
    printf "%s/%s,%s,%s,%s,%s,%s,%s,\"{%s}\",%s,%s\n",
           features[f], fi, v, cs, a, c, t, w, tagsjson, g, tagfilter_r >> output_main
}
