#!/bin/bash
################## SKELETON: DO NOT TOUCH THESE 2 LINES
BASENAME=`basename "$0" .sh`; TAB='	'; NL='
'
#################### ADD YOUR USAGE MESSAGE HERE, and the rest of your code after END OF SKELETON ##################
USAGE="USAGE: $BASENAME [OPTIONS] blant_cmd Ks EDs network.el
PURPOSE: use random samples of k-graphlets from BLANT in attempt to find large communities in network.el.
REQUIRED ARGUMENTS:
    blant_cmd is the raw BLANT command; usually it's just './blant', but can include options (eg './blant -C')
    Ks is a list of graphlet sizes to do BLANT sampling in
    EDs is a list of the edge density thresholds to explore
OPTIONS (added BEFORE the blant.exe name)
    -D DIR: use existing blant output files in directory DIR
    -T DIR: use temp space here rather than /tmp
    -A: Use Sweta Jain's Turan's Shadow code to estimate absolute counts
    -C: run on the complement graph, G' (careful, this can cause long run times)
    -1: exit after printing only one 1 cluster (the biggest one)
    -h: use only the highest count graphlet/orbit for neighbors
    -S: cluster count sorted by the normalized square
    -w: networks are edge-weighted; pass -w to BLANT to use weighted graphlets
    -v: verbose output
    -nm: 'no members': suppress list of nodes in the community
    -pD: tell BLANT to estimate graphlet counts with D digits of precision (default 1)
    -nN: tell BLANT to take exactly N samples (mutually exclusive with -p above)
    -r SEED: use the integer SEED as the random seed
    -emt value: minimum edge mean threshold: the smallest average-over-edgeWeights for a cluster to be included [default 0.5]
    -m smallest: if m>=1, ignore clusters/cliques/communities with fewer than this number of nodes; otherwise if m<1, treat
       it as a p-value and set the smallest cluster to whatever size gives the number of edges a p-value less than this;
       default behaviour is to demand a cluster whose number of edges has p-value < 1/(n choose 2)^2 (heuristic).
    -M largest: stop building a community if it reaches this size (default: no limit)
    -sSAMPLE_METHOD: BLANT's sampling method (reasonable choices are MCMC, NBE, EBE, or RES)
    -o OVERLAP: (default 0.5); the maximum allowed fractional overlap between a new cluster and any one previously discovered
	cluster (though it can overlap by more than this with MULTIPLE previous clusters). If it overlaps more than this with
	any ONE previous cluster, it is discarded.
PREDICTION
    -PN: perform edge prediction of up to N edges for each node on the 'periphery' of a communty because it has
	as many as N too few edges into the community to be added; prediction seems to work better with larger
	k, with k=8 working best at high edge densities, though lower k works OK for lower edge densities.
	NOTE: predicted edges are sent to the standard error stream (aka stderr, cerr, Unix file descriptor 2),
	so they do not litter the pipeline. To view them, it's best to run $BASENAME with '2>&1 >/dev/null'
	appended to its command line."

################## SKELETON: DO NOT TOUCH CODE HERE
# check that you really did add a usage message above
USAGE=${USAGE:?"$0 should have a USAGE message before sourcing skel.sh"}
die(){ echo "FATAL ERROR in $BASENAME:" "$@" "${NL}type $BASENAME with no arguments for help" >&2; exit 1; }
usage(){ echo "$USAGE" >&2; exit 1; }
[ "$BASENAME" == skel ] && die "$0 is a skeleton Bourne Shell script; your scripts should source it, not run it"
echo "$BASENAME" | grep "[ $TAB]" && die "Shell script names really REALLY shouldn't contain spaces or tabs"
[ $BASENAME == "$BASENAME" ] || die "something weird with filename in '$BASENAME'"
warn(){ (echo "WARNING: $@")>&2; }
not(){ if eval "$@"; then return 1; else return 0; fi; }
newlines(){ awk '{for(i=1; i<=NF;i++)print $i}' "$@"; }
parse(){ awk "BEGIN{print $*}" </dev/null; }

#################### END OF SKELETON, ADD YOUR CODE BELOW THIS LINE

[ $# = 0 ] && usage

minClusArg=0
maxClus=2147483647 # 2^31-1
minEdgeMean=0.5
RANDOM_SEED=
COMMUNITY_MODE=g  # can be g for graphlet (the default if empty), or o for orbit (which uses FAR more memory, like 10-100x)
SQR_NORM=0
WEIGHTED=''
W=''
ONLY_ONE=0
exclusive=0
SAMPLE_METHOD=-sEBE #MCMC #-sNBE
ONLY_BEST_ORBIT=0
OVERLAP=0.5
EDGE_PREDICT=0
COMPLEMENT=''
TURAN=false
DEBUG=false # set to true to store BLANT output
VERBOSE=0
QUIET=-q
PRECISION=-p0.9L
PRINT_MEMBERS=1
DENSITY_LEEWAY=0.95 # factor by which we can _initially_ keep a node in the cluster even though it lowers the density

# ensure the subfinal sort is always the same... we sort by size since the edge density is (roughly) constant
SUBFINAL_SORT="-k 1nr -k 5n"
BLANT_FILES=''

while echo "X$1" | grep '^X-' >/dev/null; do # first argument is an option
    case "$1" in
    -1) ONLY_ONE=1; shift;;
    -h) ONLY_BEST_ORBIT=1; shift;;
    -S) SQR_NORM=1; shift;;
    -w) WEIGHTED="$1"; W=w; shift;;
    -s) SAMPLE_METHOD="-s$2"; shift 2;;
    -s*) SAMPLE_METHOD="$1"; shift;;
    -D) BLANT_FILES="$2"; shift 2;;
    -T) LOCAL_TMP="$2"; shift 2;;
    -A) TURAN=true; shift;;
    -C) COMPLEMENT=-C; shift;;
    -v) VERBOSE=1; QUIET=''; shift;;
    -nm) PRINT_MEMBERS=0; shift;;
    -n) PRECISION="-n $2"; shift 2;;
    -n[0-9]*) PRECISION="$1"; shift;;
    -p[0-9]*) PRECISION="$1"L; shift;;
    -r) RANDOM_SEED="-r $2"; shift 2;;
    -emt) minEdgeMean="$2"; shift 2;;
    -r[0-9]*) RANDOM_SEED="$1"; shift 1;; # allow seed to be same or separate argument
    -m) minClusArg="$2"; shift 2;;
    -M) maxClus="$2"; shift 2;;
    -m[0-9]*) minClusArg="`echo $1|sed 's/^-m//'`"; shift 1;;
    -M[0-9]*) maxClus="`echo $1|sed 's/^-M//'`"; shift 1;;
    -o) OVERLAP="$2"; shift 2;;
    -o[0-9]*) OVERLAP="`echo $1|sed 's/^-o//'`"; shift 1;;
    -P[0-9]*) EDGE_PREDICT="`echo $1|sed 's/^-P//'`"; shift 1;;
    -*) die "unknown option '$1'";;
    esac
done

[ $# -ne 4 ] && die "expecting exactly 4 mandatory arguments, but you supplied $#"

# Temporary Filename + Directory (both, you can use either, note they'll have different random stuff in the XXXXXX part)
TMPDIR=`mktemp -d ${LOCAL_TMP:-"/tmp"}/$BASENAME.XXXXXX`
#trap "/bin/rm -rf $TMPDIR; exit" 0 1 2 3 15 # call trap "" N to remove the trap for signal N
echo "TMPDIR is $TMPDIR" >&2
[ "$BLANT_FILES" ] || BLANT_FILES="$TMPDIR"

BLANT_CMD="$1 ${PRECISION} $QUIET";
BLANT_EXE=`echo $BLANT_CMD | awk '{print $1}'`
BLANT_DIR=`dirname "$BLANT_EXE"`
source "$BLANT_DIR/setup.sh"
Ks=(`echo $2 | newlines | sort -nr`); # sort the Ks highest to lowest so the below parallel runs start the higher values of k first
#[ `echo "${Ks[@]}" | wc -w` -eq 1 ] || die "no more multiple K's at the same time"
EDs=($3)
net=$4

if [ "$COMPLEMENT" != "" ]; then
    #SAMPLE_METHOD=-sNBE # only method that works for now
    hawk 'NF==2{++D[$1];++D[$2];++edge[$1][$2];++edge[$2][$1]}
	  NF==3{D[$1]+=$3;D[$2]+=$3;edge[$1][$2]=$3;edge[$2][$1]=$3}
	END{
	    for(u in edge) for(v in edge) if(u<v)
		if(!(v in edge[u])) {
		    ASSERT(!(u in edge[v]),"oops");
		    if(NF==2) printf "%s\t%s\n", MIN(u,v),MAX(u,v)
		    if(NF==3) printf "%s\t%s\t%g\n", MIN(u,v),MAX(u,v),edge[u][v]
		}
	}' $net | sort -u > $TMPDIR/net4awk.el$W
else
    cp -p $net $TMPDIR/net4awk.el$W
fi
netCounts=`hawk '{++seen[$1];++seen[$2]}END{n=length(seen);m=NR;printf "%d\t%d\t%g\n", n, m, m/choose(n,2)}' $TMPDIR/net4awk.el$W`
numNodes=`echo "$netCounts" | cut -f1`
numEdges=`echo "$netCounts" | cut -f2`
meanED=`echo "$netCounts" | cut -f3`

[ -x $BLANT_EXE ] || die "'$BLANT_EXE' does not exist or is not an executable"
for k in "${Ks[@]}"; do
    [ "$k" -ge 3 -a "$k" -le 8 ] || die "One k is '$k' but must be between 3 and 8"
done

[ -f "$net" ] || die "network '$net' does not exist"
case "$net" in
*.el) [ "$WEIGHTED" = "" ] || die "non-weighted edgelist given with -w option";;
*.elw) [ "X$WEIGHTED" = "X-w" ] || die "weighted edgelist given without -w option";;
*) die "network '$net' must be an edgeList file ending in .el";;
esac

echo "Don't forget: edgeDensity threshold for GDVs should fluctuate randomly as the cluster is built, with threshold
something like ED+N(ED,ED/2), so that the expected density is still ED, but we're allowed to add nodes both above
and below the threshold, at random" >&2

# Pre-run the BLANTs for each k, and re-use the files for each edge density.
BLANT_EXIT_CODE=0
if [ "$BLANT_FILES" = "$TMPDIR" ]; then
    for k in "${Ks[@]}"; do
	#minEdges=`hawk 'BEGIN{edC='$EDGE_DENSITY_THRESHOLD'*choose('$k',2);rounded_edC=int(edC); if(rounded_edC < edC){rounded_edC++;} print rounded_edC}'`
	# Use MCMC because it gives asymptotically correct concentrations *internally*, and that's what we're using now.
	# DO NOT USE -mi since it will NOT output duplicates, thus messing up the "true" graphlet frequencies/concentrations
	# Possible values: MCMC NBE EBE RES
	[ -f canon_maps/canon_list$k.txt ] || continue
	ABSOLUTE_CLIQUE_COUNT=""
	CMD=""
	$TURAN && CMD="./scripts/absolute-clique-count.sh $k $net > $TMPDIR/ACC 2>/dev/null &&"'ABSOLUTE_CLIQUE_COUNT="-A `cat $TMPDIR/ACC`";'
	CMD="$CMD $BLANT_CMD $WEIGHTED $ABSOLUTE_CLIQUE_COUNT $COMPLEMENT $RANDOM_SEED -k$k $SAMPLE_METHOD -mc$COMMUNITY_MODE $net"
	eval $CMD > $TMPDIR/blant$k.out &
    done
fi

RANDOM_SEED=`echo $RANDOM_SEED | sed 's/^-r *//'` # the "-r" is needed in CMD above but remove it for awk below.

for k in "${Ks[@]}"; do
    wait; (( BLANT_EXIT_CODE += $? ))
done

for edgeDensity in "${EDs[@]}"; do
    for k in "${Ks[@]}"; do
	hawk ' # This first awk just sorts the BLANT output; it uses minimal RAM and CPU
	    BEGIN{ edC='$edgeDensity'*choose('$k',2); onlyBestOrbit='$ONLY_BEST_ORBIT';
		cMode="'$COMMUNITY_MODE'"; if(cMode=="") cMode=="g"; # graphlet uses FAR less RAM
		ASSERT(cMode=="g" || cMode=="o", "COMMUNITY_MODE must be o or g, not "cMode);
		rounded_edC=int(edC); if(rounded_edC == edC) --rounded_edC; # allow one edge less than eps
		minEdges=MAX(rounded_edC, ('$k')-1)
	    }
	    ARGIND==1 && FNR>1 && $2 {canonEdges[FNR-2]=$3}
	    ARGIND==2 && FNR>1 && ((FNR-2) in canonEdges) {for(i=1;i<=NF;i++)orbit2canon[$i]=FNR-2}
	    ARGIND==3 && $3>0 { # ensure the actual count is nonzero
		if(cMode=="o") {
		    orbit=$2; canon=orbit2canon[orbit]; edges=canonEdges[canon]; if(edges<minEdges) next;
		    item=orbit;
		} else if(cMode=="g") {
		    canon=$2; edges=canonEdges[canon]; if(edges<minEdges) next;
		    item=canon;
		}
		if(onlyBestOrbit) item=0;
		Kc[$1][item]+=$3; # increment the cluster count for appropriate item (canon/orbit)
		T[$1]+=$3; # keep total count of *all* items
		# save the neighbors of those clusters that have high edge density for BFS
		for(j=4;j<=NF;j++) ++graphletNeighbors[$1][item][$j];
	    }
	    END {
		for(u in Kc) for(item in Kc[u]) if(item) { # do not use item==0
		    ORS=" " # Output Record Separator = space, so all the following goes on one line
		    if('$SQR_NORM') print Kc[u][item]^2/T[u], u, item
		    else            print Kc[u][item], u, item # print the cluster membership count, and the node
		    for(v in graphletNeighbors[u][item]) print v
		    ORS="\n"; print ""; # finally print the newline
		}
	    }' canon_maps/canon_list$k.txt canon_maps/orbit_map$k.txt $BLANT_FILES/blant$k.out |
	sort -T $TMPDIR -gr | # > $BLANT_FILES/clus$k.sorted  # sorted [weighted] cluster-counts of all the nodes, largest-to-smallest
	hawk ' # build the actual communities; may require huge amounts of RAM and CPU, eg 10GB and 12-24h for 9wiki-topcats
	    BEGIN{if("'$RANDOM_SEED'") srand('$RANDOM_SEED');else Srand();OFS="\t"; ID=0; edgePredict='"$EDGE_PREDICT"';
		M=1*'$minClusArg'; if(M>=1) minClus=M;
		else {
		    m='$numEdges'; n='$numNodes'; eps=m/choose(n,2);
		    if(M>0)pVal=M;else pVal=1/choose(n,2)^2; # heuristic to make pVal small enough to get significant clusters
		    for(e=1;e<m;e++)if(eps^e<pVal) break;
		    for(minClus=2;minClus<n;minClus++) if('$edgeDensity'*choose(minClus,2)>=e) break;
		    if('$VERBOSE') printf "minClus %d (%d edges = pVal %g < %g for ED %g)\n", minClus, e, eps^e, pVal, eps >"/dev/stderr"
		}
		ASSERT(minClus>=1,"minClus "minClus" must be >=1");
		hrTh = sqrt('$edgeDensity')*0.9; # highRelClusCount threshold, constant over the run
	    }
	    ARGIND==1{ # get the edge list [and weights if present]
		if(NF==2)weight=1; else if(NF==3)weight=$3; else ASSERT(0, "expecting either 2 or 3 columns");
		if(weight!=1) weighted=1;
		newE = !($2 in edge[$1]);
		degree[$1]+=weight;degree[$2]+=weight;edge[$1][$2]=edge[$2][$1]=weight
		# shortcut: self-loops are left out of adj[] (they never contributed to inDeg anyway)
		if(newE && $1!=$2) { adj[$1][++adjN[$1]]=$2; adj[$2][++adjN[$2]]=$1 }
	    }
	    ARGIND==2 { # && !($2 in count) # uncomment to take only first occurence--faster but worse result
		item=$3; count[$2]+=$1; node[FNR]=$2; line[$2]=FNR;
		gnRow($2, graphletNeighbors[$2]); # gn row built via function (sub-array passed by reference is faster to index)
	}
	    function gnRow(u, gu,    i, x) {
		for(i=4; i<=NF; i++) { x=$i; if(!(x in gu) && edge[u][x] > '$minEdgeMean'/2) { # heuristic: avoid too-weak edges
		    gu[x]=1; graphletNeighbors[x][u]=1
		} }
	    }

	    # inDeg[v]/wgtInDeg[v] = number/weight of edges from v into S, maintained incrementally
	    # (O(deg(v)) per add/remove instead of O(|S|) per query). The gen stamp avoids clearing
	    # the arrays between BFSs; inD(v) is 0 for any v not touched in the current BFS.
	    function inD(v) { return (inGen[v]==gen) ? inDeg[v] : 0 }
	    function wgtInD(v) { return weighted ? ((inGen[v]==gen) ? wgtInDeg[v] : 0) : inD(v) }
	    function addToS(u,    v,j,n) { # add u to S and update the in-degrees of u neighbor in-degrees
		S[u]=1; Slen++;
		n=adjN[u]+0; # numeric index is ~1.8x faster than for-in
		if(weighted) {
		    for(j=1;j<=n;j++) { v=adj[u][j]
			if(inGen[v]!=gen){inGen[v]=gen; inDeg[v]=1; wgtInDeg[v]=edge[u][v]}
			else {++inDeg[v]; wgtInDeg[v]+=edge[u][v]}
		    }
		} else {
		    for(j=1;j<=n;j++) { v=adj[u][j]
			if(inGen[v]!=gen){inGen[v]=gen; inDeg[v]=1}
			else ++inDeg[v]
		    }
		}
	    }
	    function removeFromS(u,    v,j,n) { # remove u from S and update the in-degrees of u neighbor in-degrees
		delete S[u]; Slen--;
		n=adjN[u]+0;
		if(weighted) {
		    for(j=1;j<=n;j++) { v=adj[u][j]; if(inGen[v]==gen) {--inDeg[v]; wgtInDeg[v]-=edge[u][v]} }
		} else {
		    for(j=1;j<=n;j++) { v=adj[u][j]; if(inGen[v]==gen) --inDeg[v] }
		}
	    }
	    function fillDegreeInS(    u,v,j,n,p,i,nS,pos,mn,enc,enc2node,order,nEnc) { # populate degreeInS with the in-cluster
		# degrees of the members of S, creating the keys in EXACTLY the order InducedEdges(edge,S,degreeInS)
		# would (row-major first touch over S, then isolated nodes in S order), because the @val_num_asc
		# tie-break of the pruning loops depends on that key-creation order. A node u is first touched at
		# pair (min(mn,pos), max(mn,pos)) where mn = S-position of its first S-neighbor; row keys are created
		# before column keys of the same pair. Cost is O(sum of degrees in S), not O(|S|^2).
		MakeEmptySet(degreeInS);
		nS=length(S);
		i=0; for(u in S) { ++i; pos[u]=i }
		for(u in S) {
		    mn[u]=0; n=adjN[u]+0;
		    for(j=1;j<=n;j++) { v=adj[u][j]; if(v in S) { p=pos[v]; if(mn[u]==0 || p<mn[u]) mn[u]=p } }
		}
		for(u in S) if(mn[u]!=0) {
		    if(mn[u] < pos[u]) enc = mn[u]*(2*nS) + pos[u]*2 + 1; # first touched as column key
		    else enc = pos[u]*(2*nS) + mn[u]*2; # first touched as row key (or self-loop)
		    enc2node[enc] = u;
		}
		nEnc=0; for(enc in enc2node) ++nEnc;
		asorti(enc2node, order, "@ind_num_asc");
		for(i=1; i<=nEnc; i++) degreeInS[enc2node[order[i]]] = 0;
		for(u in S) degreeInS[u] = inD(u); # values; also creates the isolated keys in S order
	    }
	    function AppendNeighbors(u,    v,oldOrder,cu) { # lo = line[origin], set per BFS in END
		oldOrder=PROCINFO["sorted_in"];
		if(u in graphletNeighbors) {
		    # The default is to append them in random order... no significant difference on small networks
		    PROCINFO["sorted_in"]="randsort";
		    cu = (u in count) ? count[u] : 0;
		    for(v in graphletNeighbors[u]) {
			if(!(v in visitedQ) && (!(v in line) || line[v] > lo) &&
			    (cu==0 || ((v in count) && count[v]!=0 && count[v]/cu>=hrTh))) { # highRelClusCount heuristic, inlined
			    qv[++qL]=v;
			    visitedQ[v]=1;
			}
		    }
		    PROCINFO["sorted_in"]=oldOrder;
		}
	    }
	    END{n=length(degree); # number of nodes in the input network
		if('$edgeDensity'==1) density_leeway=1;
		else density_leeway = '$DENSITY_LEEWAY';
		edThr = '$edgeDensity' * density_leeway;
		# The old EdgesIntoS/InducedEdges asserted on edge[] entries that are not a symmetric, nonzero, non-self edge
		# (zero weights, self-loops, or keys auto-created by the edge[$2][$i] lookups above). inDeg skips those, so
		# precompute them to fail at the same points: badEdge[v] = u with (v in edge[u]) && !edge[v][u];
		# asymEdge[u] = v with (v in edge[u]) && !(u in edge[v]); loopEdge[u] if (u in edge[u]).
		for(u in edge) for(v in edge[u]) {
		    if(u==v) loopEdge[u]=1;
		    else if(!(v in edge) || !(u in edge[v])) { badEdge[v][++badN[v]]=u; asymEdge[u][++asymN[u]]=v }
		    else if(!edge[v][u]) badEdge[v][++badN[v]]=u;
		}
		# make cluster and started empty sets; started is a list of nodes we should NOT start a new BFS on
		delete cluster; cluster[0]=1; delete cluster[0];
		delete started; started[0]=1; delete started[0];
		numClus=0;
		qF=1; qL=0;
		for(start=1; start<=int(FNR*'$edgeDensity'); start++) { # look for a cluster starting on line "start".
		    origin=node[start];
		    if(started[origin]) continue;
		    #printf "line %d origin %s;", start, origin > "/dev/stderr"
		    started[origin]=1;
		    MakeEmptySet(S);
		    MakeEmptySet(visitedQ);
		    misses=0; # how many nodes have been skipped because they did not work?
		    qF=1; qL=0; # empty the queue
		    qv[++qL]=origin;
		    visitedQ[origin] = 1;
		    wgtEdgeCount = edgeCount = 0; p1filled=0; p1del=0;
		    ++gen; # new generation of inDeg/wgtInDeg values
		    Slen=0;
		    lo = line[origin];
		    while(qL>=qF){
			u = qv[qF++];
			ASSERT(!(u in S),"u in S error");
			if(u in badN) for(j=1;j<=badN[u];j++) ASSERT(!(badEdge[u][j] in S),"edge error");
			newEdgeHits = inD(u);
			wgtEdgeHits = weighted ? wgtInD(u) : newEdgeHits;
			edgeCount += newEdgeHits;
			wgtEdgeCount += wgtEdgeHits;
			addToS(u);
			ASSERT(Slen > 0, "Slen must be > 0 but is "Slen);
			if(Slen >= '$maxClus') break;
			# CAREFUL: calling InducedEdges(S) every QueueNext() is VERY expensive; uncommenting the line below
			# slows the program by more than 100x (NOT an exaggeration)
			# WARN(edgeCount == InducedEdges(edge,S),"Slen "Slen" edgeCount "edgeCount" Induced(S) "InducedEdges(edge,S));
			Sorder[Slen]=u; # no need to delete this element if u fails because Slen will go down by 1
			if (Slen==1)
			    AppendNeighbors(u);
			else {
			    maxEdges = Slen*(Slen-1)/2;
			    if(edgeCount/maxEdges < edThr) {
				removeFromS(u); # u drops the edge density too low, so nuke it
				if(edgePredict) {
				    if((edgeCount+edgePredict)/maxEdges >= '$edgeDensity') {
					# just ONE edge would put us over the threshold; predict it should exist
					numPredict=0;
					for(uu in S)if(!(u in edge[uu]))
					    #printf "predictEdge-%d\t%s\t%s\n",++numPredict, u,uu > "/dev/stderr"
					WARN(numPredict<=edgePredict,"should only get "edgePredict" new edge predictions but got "numPredict);
				    }
				}
				edgeCount -= newEdgeHits;
				wgtEdgeCount -= wgtEdgeHits;
				if(++misses > MAX(Slen+1, n/100)) break; # Slen+1: old code measured S before u was removed; 1% of number of nodes is a heuristic...
				# keep going until count decreases significantly; remove duplicate clusters in next awk
			    } else {
				misses=0;
				AppendNeighbors(u);
			    }
			}
		    }
		    #printf " |S|=%d edgeMean %g", length(S), wgtEdgeCount/(edgeCount?edgeCount:1) > "/dev/stderr"
		    for(u in S) { # InducedEdges would have failed here on a self-loop or one-sided edge inside S
			if(u in loopEdge) ASSERT(0, "edgeCount "edgeCount" disagrees(1) with InducedEdges: self-loop on "u);
			if(u in asymN) for(j=1;j<=asymN[u];j++) ASSERT(!(asymEdge[u][j] in S), "edgeCount "edgeCount" disagrees(1) with InducedEdges: one-sided edge "u" "asymEdge[u][j]);
		    }
		    if(qL<qF && Slen > 1) {
			# post-process to remove nodes with too low in-cluster degree---quite relevant for lower density
			# communities where a node may be added because it does not
			# reduce the *mean* degree of the cluster, but it does not really have sufficiently strong
			# connections to the actual members of the community. We use two criteria:
			# 1) the in-cluster degree is more than 3 sigma below the mean, or
			# 2) the in-cluster degree is less than 1/3 the mode of the in-cluster degree distribution.
			# The latter was added in response to our performance on the LFR graphs, but it does not appear
			# to hurt performance anywhere else.
			StatReset(""); delete degFreq;
			fillDegreeInS(); p1filled=1;
			for(v in S) { StatAddSample("", degreeInS[v]); ++degFreq[degreeInS[v]]; }
			maxFreq=degMode=0;
			for(d=StatMax("");d>=StatMin("");d--)
			    if(d in degFreq && degFreq[d] >= maxFreq) { # use >= to extract SMALLEST mode
				maxFreq=degFreq[d]; degMode=d
			}
			pmean = StatMean(""); psd = StatStdDev(""); # constant over the loop
			#printf " deg mean %g stdDev %g maxFreq %d degMode %d; pruning...", pmean, psd, maxFreq, degMode > "/dev/stderr"
			PROCINFO["sorted_in"] = "@val_num_asc"; # for loop through in-degrees, smallest first
			for(v in degreeInS) {
			    if(degreeInS[v] < pmean - 3*psd || degreeInS[v] < degMode/3) {
				#printf " %s(%d)", v, degreeInS[v] > "/dev/stderr";
				removeFromS(v); p1del++;
				edgeCount -= inD(v);
				wgtEdgeCount -= wgtInD(v);
			    }
			}
			#printf " |S|=%d", _statN[""] > "/dev/stderr"
		    }
		    edEntry = (Slen>=2) ? edgeCount / (Slen*(Slen-1)/2) : 1;
		    if(edEntry < '$edgeDensity' && !(p1filled && p1del==0)) fillDegreeInS(); # skip the refresh when prune1 left S untouched
		    PROCINFO["sorted_in"] = "@val_num_asc"; # for loop through in-degrees, smallest first
		    for(v in degreeInS) {
			if(Slen<2) break;
			if(edgeCount / (Slen*(Slen-1)/2) >= '$edgeDensity') break; # break once ED is above threshsold
			removeFromS(v);
			edgeCount -= inD(v);
			wgtEdgeCount -= wgtInD(v);
		    }
		    if(Slen>1) {
			ed = edgeCount / (Slen*(Slen-1)/2);
			WARN(ed >= '$edgeDensity',"hmmm, ed is "ed);
		    }
		    #printf " |S|=%d", _statN[""] > "/dev/stderr"
		    if(Slen>=minClus && wgtEdgeCount/edgeCount>='$minEdgeMean') {
			maxEdges=Slen*(Slen-1)/2;
			#print " ACCEPTED" > "/dev/stderr";
			++numClus; printf "%d %d %g", Slen, edgeCount, wgtEdgeCount
			for(u in S) {cluster[numClus][u]=1; printf " %s", u;}
			print "";
			# now mark as "started" the first half of S that was filled... or more generally, some fraction.
			# We choose the top (1-OVERLAP) fraction because OVERLAP is meant to be less stringent as it
			# approaches 1, which in the case of THIS loop means that if OVERLAP is close to 1, we want
			# to eliminate a SMALLER proportion (ie., allow more) of future BFS starts, so if OVERLAP=1,
			# we eliminate NOTHING in this loop.
			for(i=1;i<Slen*(1-'$OVERLAP');i++) started[Sorder[i]]=1;
		    }
		    #else print " REJECTED" > "/dev/stderr";
		}
	    }
	' "$TMPDIR/net4awk.el$W" - | # dash is the output of the above pipe (sorted cluster counts)
	sort -T $TMPDIR -nr |
	hawk ' # attempt to remove duplicate clusters... not sure how intensive it is in RAM and CPU (yet)
	    BEGIN{ numClus=0 } # post-process to only EXACT duplicates (more general removal later)
	    FNR>1 && '$ONLY_ONE'{exit}
	    {
		delete S;
		numNodes=$1
		edgeHits=$2;
		edgeWgts=$3;
		for(i=4;i<=NF;i++) ++S[$i]
		WARN(length(S)==numNodes,"mismatch(1) in numNodes and length(S)");
		# Sorted by size, largest first, so a previous cluster is a subset of S only if it IS S: hash the
		# sorted members to find duplicates instead of scanning every earlier cluster.
		m = asorti(S, sorted);
		key = sorted[1];
		for(i=2;i<=m;i++) key = key SUBSEP sorted[i];
		if(key in seenKey) next;
		seenKey[key] = 1;
		++numClus; edges[numClus]=edgeHits; edgeSum[numClus]=edgeWgts;
		for(u in S) ++cluster[numClus][u] # same hash order as before keeps the member print order unchanged
	    }
	    END{
		for(i=1;i<=numClus;i++) {
		    maxEdges=choose(length(cluster[i]),2);
		    printf "%d %d %g '$k'",length(cluster[i]),edges[i],edgeSum[i]
		    for(u in cluster[i]) printf " %s", u
		    print ""
		}
	    }
	    ' | # sort by number of nodes, then by first node in the list:
	sort -T $TMPDIR $SUBFINAL_SORT > $TMPDIR/subfinal$k$edgeDensity.out & # sort by number of nodes, then by first node in the list
    done
    for k in "${Ks[@]}"; do
	    wait; (( BLANT_EXIT_CODE += $? ))
    done
done

# we can use the --merge option because the subfinal files are already sorted in SUBFINAL_SORT order
sort -T $TMPDIR --merge $SUBFINAL_SORT $TMPDIR/subfinal*.out |
    hawk 'BEGIN{ numClus=0 } # post-process to remove/merge duplicates
	{
	    delete S;
	    numNodes=$1
	    edgeHits=$2;
	    edgeWgts=$3;
	    k=$4;
	    for(i=5;i<=NF;i++) ++S[$i]
	    WARN(length(S)==numNodes,"mismatch(2) in numNodes and length(S)");
	    add=1;
	    # Only clusters sharing a node with S can overlap it, so the inverted index nodeClus (node -> cluster
	    # ids) limits the checks to those candidates rather than scanning every cluster.
	    delete cand;
	    for(u in S) for(c in nodeClus[u]) cand[c]=1;
	    for(c in cand) {
		same=0;
		for(u in S) if(u in cluster[c])++same;
		if(same > length(S)*'$OVERLAP'){ add=0; break;} # we check ONLY if $OVERLAP fraction of the NEW cluster
		# overlaps any one old cluster... it is TOTALLY ALLOWED to completely overlap the old cluster if it is
		# lower density, for example, so the below check is incorrect.
		#if(same > MAX(length(S), length(cluster[i]))*'$OVERLAP'){ add=0; break;}
	    }
	    # Skipping an entire cluster with overlap sucks, but merging does not work either. Here is a better way:
	    # The idea is to provide ALTERNATES.  So for example if 2 clusters of size k overlap in all but one node,
	    # and have the same total number of edges, then the 2 nodes that are OUTSIDE the overlap form "alternate"
	    # forms of an identical cluster, at least in quality. (It is likely that they effectively form identical
	    # graphlets with a large k, and the 2 nodes occupy the same orbit in the graphlet). So if node A can be
	    # swapped out with node B to get an identical quality cluster, then that could be listed as "one" node
	    # A#B in the output, meaning A and B can we swapped and you still get the same number of nodes and edges,
	    # while adding both does not work. Doing this correctly requires some thought, so it will have to wait.

	    if(add) {
		++numClus; edges[numClus]=edgeHits; edgeSum[numClus]=edgeWgts; kk[numClus]=k;
		for(u in S) { ++cluster[numClus][u]; nodeClus[u][numClus]=1; }
	    }
	}
	END {
	    PROCINFO["sorted_in"]="@ind_num_asc"; # print nodes in numerical ascending order
	    #PROCINFO["sorted_in"]="@ind_str_asc"; # print nodes in string ascending order
	    for(i=1;i<=numClus;i++) {
		maxEdges=choose(length(cluster[i]),2);
		edgeMean = edgeSum[i]/edges[i];
		ASSERT(edgeMean>='$minEdgeMean', "oops, should not get this far with an edgeMean of "edgeMean);
		printf "%d nodes, %d/%d edges, %g%% density from k%d", length(cluster[i]), edges[i], maxEdges,
		    100*edges[i]/maxEdges, k
		if('$VERBOSE') printf " from k %d, %g clusterWeight, %g edgeSum, %g edgeMean", kk[i],
		    edgeSum[i]/length(cluster[i]), edgeSum[i], edgeMean
		if('$PRINT_MEMBERS') {
		    printf ", nodeSet {"
		    for(u in cluster[i]) printf " %s", u
		    printf " }"
		}
		print ""
	    }
	}' | sort -T $TMPDIR -k 1nr -k 3nr -k 9n # sort order: edge density, number of nodes, value of k
#set -x
exit $BLANT_EXIT_CODE
