function escape_json(str) {
    gsub(/\\/, "\\\\", str);
    gsub(/"/, "", str);
    gsub(/%20%/, " ", str);
    return str;
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
}

{
    f = substr($1, 1, 1);          # Feature
    fi = substr($1, 2);            # Feature id
    v = substr($2, 2);             # Version
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
                printf "%s/%s,%s/%s,%s,%s\n",
                    features[substr(Nlist[j], 1, 1)], substr(Nlist[j], 2), features[f], fi, v, j >> output_members
            }
        }
    } else if (f == "r"){
        
    }

    n=split(T, tag_pairs, /,/);
    tagsjson = "";
    for (j=1 ; j<=n ; j++){
        split(tag_pairs[j], kv, /=/);
        tagsjson = (j > 1 ? tagsjson "," : "") "\"\"" escape_json(kv[1]) "\"\":\"\"" escape_json(kv[2]) "\"\"";

        if (length(tagfilter) > 0){
            tag_str = "\"" kv[1] "\":\"" kv[2] "\""
            for (i in tagsconds) {
                results[i] = results[i] || tag_str ~ tagsconds[i]
            }
        }
    }

    # Validation du filtre sur les tags
    if (length(tagfilter) > 0 && tagfilter_r){
        localresult[1] = false
        for (i in results){
            split(i, indices, SUBSEP)
            localresult[indices[1]] = localresult[indices[1]] || results[i]
        }
        for (i in localresult){
            tagfilter_r = tagfilter_r && localresult[i]
        }
    }

    # Construction de la sortie CSV principale
    printf "%s/%s,%s,%s,%s,%s,%s,%s,\"{%s}\",%s,%s\n",
           features[f], fi, v, a, c, t, w, u, tagsjson, g, tagfilter_r >> output_main
}
