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
    -X N: CORE refinement: grow each community while its density stays above the threshold, then try up to N
	region-exploration rounds on it. Default (no -X): grow only, no region rounds. 0 = off (no refinement at all).
	Region rounds (eg -X 20) enlarge the second-tier communities in about half of cases, at roughly 25% more time.
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
SUBFINAL_SORT="-k 2nr -k 5n"
BLANT_FILES=''

# CORE refinement (region exploration, https://github.com/pieterhv/CORE)
CORE_REFINE=1 # grow each community after the BFS; -X 0 switches this (and so all refinement) off
CORE_ITERS=0  # maximum region-exploration rounds per community, on top of growing it; set by -X N
CORE_X_GIVEN=false
CORE_STALL=5  # stop refining a community after this many consecutive rounds that fail to improve it

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
    -X) CORE_ITERS="$2"; CORE_X_GIVEN=true; shift 2;;
    -X[0-9]*) CORE_ITERS="`echo $1|sed 's/^-X//'`"; CORE_X_GIVEN=true; shift 1;;
    -*) die "unknown option '$1'";;
    esac
done

echo "X$CORE_ITERS" | grep '^X[0-9][0-9]*$' >/dev/null || die "-X needs a non-negative integer, not '$CORE_ITERS'"
$CORE_X_GIVEN && [ "$CORE_ITERS" -eq 0 ] && CORE_REFINE=0
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
	ED='$edgeDensity'; maxClus='$maxClus'; coreRefine='$CORE_REFINE'; coreIters='$CORE_ITERS'; coreStall='$CORE_STALL';
	OVERLAP='$OVERLAP'; minEdgeMean='$minEdgeMean'; coreNoSkip=ENVIRON["BLANT_CLUSTERS_NOSKIP"]; # debugging: if set, refine even covered communities
	coreNoEstimate=ENVIRON["BLANT_CLUSTERS_NOESTIMATE"]; # debugging: if set, really add every region (exercises undo)
	coreNoRounds=ENVIRON["BLANT_CLUSTERS_NOROUNDS"]; # debugging/benchmarking: if set, fill only, no region rounds
	coreCheck=ENVIRON["BLANT_CLUSTERS_CHECK"]; # debugging: if set, verify every refined community (slow)
		M=1*'$minClusArg'; if(M>=1) minClus=M;
		else {
		    m='$numEdges'; n='$numNodes'; eps=m/choose(n,2);
		    if(M>0)pVal=M;else pVal=1/choose(n,2)^2; # heuristic to make pVal small enough to get significant clusters
		    for(e=1;e<m;e++)if(eps^e<pVal) break;
		    for(minClus=2;minClus<n;minClus++) if('$edgeDensity'*choose(minClus,2)>=e) break;
		    if('$VERBOSE') printf "minClus %d (%d edges = pVal %g < %g for ED %g)\n", minClus, e, eps^e, pVal, eps >"/dev/stderr"
		}
		ASSERT(minClus>=1,"minClus "minClus" must be >=1");
	    }
	    ARGIND==1{ # get the edge list [and weights if present]
		if(NF==2)weight=1; else if(NF==3)weight=$3; else ASSERT(0, "expecting either 2 or 3 columns");
		degree[$1]+=weight;degree[$2]+=weight;edge[$1][$2]=edge[$2][$1]=weight
	    }
	    ARGIND==2 { # && !($2 in count) # uncomment to take only first occurence--faster but worse result
		item=$3; count[$2]+=$1; node[FNR]=$2; line[$2]=FNR;
		for(i=4; i<=NF; i++) if(($2 in edge) && ($i in edge[$2]) && edge[$2][$i] > '$minEdgeMean'/2) # heuristic: avoid too-weak edges
		    graphletNeighbors[$2][$i]=graphletNeighbors[$i][$2]=1;
	    }

	    # insert degreeInS keys in the order InducedEdges() would, since a sorted for-in breaks ties by insertion order
	    function DegreeInSKeys(    u,v,n,i,j,m,ord,pos,nb,oldOrder,sumDeg) {
		MakeEmptySet(degreeInS);
		n=0; sumDeg=0; for(u in S) { ord[++n]=u; pos[u]=n; if(u in edge) sumDeg+=length(edge[u]); } # current sorted_in
		if(n*n <= 4*sumDeg) {
		    for(i=1;i<=n;i++) for(j=1;j<=n;j++) if((ord[i] in edge) && (ord[j] in edge[ord[i]])) { ++degreeInS[ord[i]]; ++degreeInS[ord[j]]; }
		    return;
		}
		oldOrder=PROCINFO["sorted_in"]; PROCINFO["sorted_in"]=""; # neighbor order is re-sorted below; skip sorting here
		for(i=1;i<=n;i++) {
		    u=ord[i]; if(!(u in edge)) continue;
		    delete nb; m=0;
		    for(v in edge[u]) if(v in pos) nb[++m]=pos[v];
		    if(m==0) continue;
		    if(!(u in degreeInS)) degreeInS[u]=0;
		    asort(nb);
		    for(j=1;j<=m;j++) { v=ord[nb[j]]; if(!(v in degreeInS)) degreeInS[v]=0; }
		}
		PROCINFO["sorted_in"]=oldOrder;
	    }
	    # d=+1 when u joins S, -1 when it leaves; edgesIntoS/wgtIntoS are never iterated, so skip sorting edge[u]
	    function IntoS(u,d,    w) {
		if(!(u in edge)) return;
		for(w in edge[u]) { edgesIntoS[w]+=d; wgtIntoS[w]+=d*edge[u][w]; }
	    }
	    function RemoveFromS(v) {
		delete S[v];
		edgeCount -= edgesIntoS[v]+0;
		wgtEdgeCount -= wgtIntoS[v]+0;
		IntoS(v,-1);
	    }
	    # ---- CORE refinement (-X), after https://github.com/pieterhv/CORE. Runs once per community, after the BFS and
	    # its trimming, on a valid community S (density >= ED). All state below is global and rebuilt by CoreInit().
	    # Outside nodes and members sit on per-degree stacks (degree = edgesIntoS) with lazy deletion: an entry is
	    # stale if the node has since changed degree or side. This finds the best outside node and the worst member
	    # without scanning the boundary or S. (Never pick from a bucket with for-in: gawk lists every key first.)
	    # bnd[1..nBnd] lists every node that has been on the boundary (outside S with an edge into S) for this seed.
	    function CorePushOut(w,d) {
		outStk[d][++outTop[d]]=w; if(d>maxOut) maxOut=d;
		if(!(w in inBnd)) { inBnd[w]=1; bnd[++nBnd]=w; }
	    }
	    # Only nodes that refinement itself added can be removed again: the members the BFS found (corePre) are never
	    # filed here. Without that, every seed in a neighborhood drifts to the same best community and the later
	    # overlap filter throws nearly all of them away; with it, a community can only gain nodes.
	    function CorePushIn(v,d)  { if(v in corePre) return; inStk[d][++inTop[d]]=v; if(d<minIn) minIn=d; }
	    function CoreInit(    v,w) {
		PROCINFO["sorted_in"]="";
		delete mem; delete memPos; delete outStk; delete outTop; delete inStk; delete inTop; delete bnd; delete inBnd;
		nBnd=0; cN=0; maxOut=0; minIn=2147483647; nLog=0; logging=0;
		for(v in S) { mem[++cN]=v; memPos[v]=cN; CorePushIn(v, edgesIntoS[v]+0); }
		for(w in edgesIntoS) if(!(w in S) && edgesIntoS[w]>0) CorePushOut(w, edgesIntoS[w]);
	    }
	    # like IntoS, but also files each neighbor under its new degree
	    function CoreInto(u,d,    w,x) {
		if(!(u in edge)) return;
		for(w in edge[u]) { # the hottest loop of refinement: CorePushIn/CorePushOut are written out here, not called
		    x=(edgesIntoS[w]+=d); wgtIntoS[w]+=d*edge[u][w];
		    if(w in S) { if(!(w in corePre)) { inStk[x][++inTop[x]]=w; if(x<minIn) minIn=x; } }
		    else if(x>0) {
			outStk[x][++outTop[x]]=w; if(x>maxOut) maxOut=x;
			if(!(w in inBnd)) { inBnd[w]=1; bnd[++nBnd]=w; }
		    }
		}
	    }
	    function CoreAdd(u) {
		edgeCount += edgesIntoS[u]+0; wgtEdgeCount += wgtIntoS[u]+0;
		S[u]=1; mem[++cN]=u; memPos[u]=cN;
		CoreInto(u,1); CorePushIn(u, edgesIntoS[u]+0);
		if(logging) { logN[++nLog]=u; logT[nLog]=1; }
	    }
	    function CoreDrop(v,    p,last) {
		delete S[v];
		edgeCount -= edgesIntoS[v]+0; wgtEdgeCount -= wgtIntoS[v]+0;
		p=memPos[v]; last=mem[cN]; mem[p]=last; memPos[last]=p; delete mem[cN]; delete memPos[v]; --cN;
		CoreInto(v,-1); if(edgesIntoS[v]>0) CorePushOut(v, edgesIntoS[v]);
		if(logging) { logN[++nLog]=v; logT[nLog]=-1; }
	    }
	    function CoreBestOut(    t,w) { # outside node with the most edges into S, or "" if S has no outside neighbors
		for(; maxOut>0; --maxOut) {
		    for(t=outTop[maxOut]+0; t>0; --t) {
			w=outStk[maxOut][t];
			if(!(w in S) && edgesIntoS[w]==maxOut) { outTop[maxOut]=t; return w; }
			delete outStk[maxOut][t];
		    }
		    outTop[maxOut]=0;
		}
		return "";
	    }
	    function CoreWorstIn(    t,v) { # removable member with the fewest edges into S, or "" if there is none
		for(; minIn<cN; ++minIn) {
		    for(t=inTop[minIn]+0; t>0; --t) {
			v=inStk[minIn][t];
			if((v in S) && edgesIntoS[v]+0==minIn) { inTop[minIn]=t; return v; }
			delete inStk[minIn][t];
		    }
		    inTop[minIn]=0;
		}
		return "";
	    }
	    function CoreValid() { return cN<2 || edgeCount/(cN*(cN-1)/2) >= ED; }
	    # CORE "valid quasi-clique, so add a node": add the best outside node for as long as density stays >= ED
	    function CoreFill(    b) {
		while(cN<coreCap) {
		    b=CoreBestOut();
		    if(b=="" || (edgeCount+edgesIntoS[b])/((cN+1)*cN/2) < ED) break;
		    CoreAdd(b);
		}
	    }
	    function CoreUndo(    i) { # put S back exactly as it was when logging was switched on
		logging=0;
		for(i=nLog;i>=1;i--) if(logT[i]>0) CoreDrop(logN[i]); else CoreAdd(logN[i]);
		nLog=0;
	    }
	    # region start: a random boundary node that leads somewhere. (CORE takes a random node from the whole graph, which on a large
	    # sparse network almost never lands near S; choosing a random member and stepping out almost never finds the
	    # few members that bridge to another dense group.)
	    function CoreStart(    i,w) {
		for(i=1; i<=30 && nBnd>0; i++) { # bnd also holds nodes that have since joined S or lost their edges into it
		    w=bnd[1+int(rand()*nBnd)];
		    # it must have a neighbor outside S, or it has no region to bring and fill has already rejected it alone
		    if(!(w in S) && edgesIntoS[w]>0 && length(edge[w])>edgesIntoS[w]) return w;
		}
		return "";
	    }
	    # Scan the neighbors of region node r. With inc set, r has just joined the region, so count its edges in
	    # regDeg. Returns the best neighbor of r outside S and the region: the one with the most edges into S plus the
	    # region (CORE select_to_add_neighborhood, looking around one region node instead of three). Ties go to the
	    # node of higher degree, which can still connect to nodes the region has yet to reach, then at random.
	    function CoreScan(r,inc,    w,d,g,bd,bg,b,ties) {
		bd=-1; b="";
		if(r in edge) for(w in edge[r]) {
		    if(inc) ++regDeg[w];
		    if(!(w in S) && !(w in inReg)) {
			d=edgesIntoS[w]+regDeg[w]; g=length(edge[w]);
			if(d>bd || (d==bd && g>bg)) { bd=d; bg=g; b=w; ties=1; }
			else if(d==bd && g==bg && rand()*(++ties)<1) b=w;
		    }
		}
		return b;
	    }
	    # CORE region_exploration. Build a connected region of outside nodes, then try to take it into S:
	    #   (a) if S plus some prefix of the region is already a valid community, add the longest such prefix;
	    #   (b) otherwise add the whole region and remove the worst removable members until S is valid again.
	    # Then fill. The round succeeds if S grew (or kept its size and gained edges); if not, S is put back.
	    # Most rounds fail, so the region is first built and judged on paper (regDeg, regG), without touching S:
	    # (a) is decided exactly, and (b) is attempted only if an estimate says it can leave S larger.
	    # Region size is random between an eighth and a half of S (at least 3, at most 200): measured on the PPI
	    # networks, regions of 2 almost never succeed (fill has already tried every single node) while larger
	    # ones succeed 10-35% of the time.
	    function CoreRound(    before,eBefore,x,R,lo,hi,ok,G,i,j,d,t,v,m,n2,e2,found,step,nRem,remV,remD,seenV) {
		before=cN; eBefore=edgeCount;
		x=CoreStart(); if(x=="") return 0;
		lo=MIN(200,MAX(3,int(cN/8))); hi=MIN(200,MAX(lo,int(cN/2))); R=MIN(lo+int(rand()*(hi-lo+1)), maxClus-cN);
		if(R<1) return 0; # (the region may take S past coreCap for a moment; what is kept may not be)
		delete reg; delete inReg; delete regDeg; delete regG; nReg=0; G=0;
		while(x!="" && nReg<R) {
		    G+=edgesIntoS[x]+regDeg[x]; reg[++nReg]=x; inReg[x]=1; regG[nReg]=G; # regG[j]: edges gained by adding reg[1..j]
		    x=CoreScan(x,1);
		    for(i=1; x=="" && i<=2 && nReg>1; i++) x=CoreScan(reg[1+int(rand()*nReg)],0); # dead end: look elsewhere
		}
		# (a) the longest prefix that keeps S valid as it is
		for(j=MIN(nReg,coreCap-before); j>=1; j--) if((eBefore+regG[j])/((before+j)*(before+j-1)/2) >= ED) break;
		if(j>=1) { for(i=1;i<=j;i++) CoreAdd(reg[i]); CoreFill(); return 1; }
		# (b) estimate, for the whole region and then for up to 7 shorter prefixes of it: after adding reg[1..j],
		# does removing at most j of the worst removable members make S valid, and larger or at least richer in
		# edges than it was? Each removed member is assumed to take all its edges with it, which overstates the
		# loss when two of them are adjacent, so this errs towards not trying.
		# First list the nReg worst removable members, lowest degree first. Each bucket read is rewritten without
		# its stale and repeated entries, so they are not waded through again next round.
		nRem=0; delete seenV;
		for(d=minIn; d<before && nRem<nReg; d++) {
		    m=0;
		    for(t=1; t<=inTop[d]+0; t++) {
			v=inStk[d][t];
			if((v in S) && !(v in seenV) && edgesIntoS[v]+0==d) {
			    seenV[v]=1; inStk[d][++m]=v;
			    if(nRem<nReg) { remV[++nRem]=v; remD[nRem]=d; }
			}
		    }
		    inTop[d]=m;
		}
		found=0; step=MAX(1,int(nReg/8));
		for(j=nReg; j>=2 && !found; j-=step) {
		    n2=before+j; e2=eBefore+regG[j];
		    for(m=1; m<=nRem && m<=j; m++) {
			--n2; e2-=remD[m]+regDeg[remV[m]];
			if(n2<=coreCap && e2/(n2*(n2-1)/2) >= ED) { found=(n2>before || e2>eBefore); break; }
		    }
		}
		if(!found) {
		    if(!coreNoEstimate) return 0;
		    j=nReg-step; # debugging: try the whole region for real anyway
		}
		nReg=j+step; # the prefix that passed
		nLog=0; logging=1;
		for(i=1;i<=nReg;i++) CoreAdd(reg[i]);
		while(cN>1 && (cN>coreCap || !CoreValid()) && (x=CoreWorstIn())!="") CoreDrop(x);
		CoreFill();
		ok=(CoreValid() && cN<=coreCap && (cN>before || (cN==before && edgeCount>eBefore)));
		if(!ok) { CoreUndo(); ++coreUndone; }
		logging=0;
		return ok;
	    }
	    function CoreRefine(    oldOrder,it,no) {
		oldOrder=PROCINFO["sorted_in"];
		CoreInit();
		# A community may at most double. Measured on HI-union and DMelanogaster: communities that more than
		# doubled had almost always (478 of 480 at ED 0.25 on HI-union) just grown into one refined earlier, which
		# costs most of the refinement time and then loses the community to the overlap filter.
		coreCap=MIN(maxClus, 2*cN);
		CoreFill();
		# region rounds are the expensive part; a community still too small to be reported after filling is not worth them
		no=0; if(cN>=minClus && !coreNoRounds) for(it=1; it<=coreIters && no<coreStall; it++) { ++coreRounds; if(CoreRound()) no=0; else ++no; }
		PROCINFO["sorted_in"]=oldOrder;
	    }
	    # Is more than the OVERLAP fraction of S inside one community that was refined earlier? The final overlap
	    # filter discards such a community anyway (the earlier one is at least as large), so refining it is wasted.
	    function CoreCovered(    v,c,lim,cnt) {
		if(coreNoSkip) return 0;
		lim=length(S)*OVERLAP;
		for(v in S) if(v in coreNodeClus) for(c in coreNodeClus[v]) if(++cnt[c] > lim) return 1;
		return 0;
	    }
	    function CoreCheck(preN,preE,preW,    u,v,w,e,n) { # debugging (BLANT_CLUSTERS_CHECK): the bookkeeping must match S
		PROCINFO["sorted_in"]="";
		n=length(S); e=InducedEdges(edge,S); w=0;
		for(u in S) if(u in edge) for(v in S) if(v in edge[u]) w+=edge[u][v];
		ASSERT(cN==n, "CoreCheck: member count "cN" but S has "n);
		ASSERT(edgeCount==e, "CoreCheck: edgeCount "edgeCount" but S induces "e);
		ASSERT(ABS(wgtEdgeCount-w/2) <= 1e-9*(1+w), "CoreCheck: wgtEdgeCount "wgtEdgeCount" but S induces "w/2);
		ASSERT(n<2 || e/choose(n,2) >= ED, "CoreCheck: density "e"/"choose(n,2)" is below "ED);
		ASSERT(n<=maxClus, "CoreCheck: size "n" exceeds maximum "maxClus);
		ASSERT(n<=2*preN, "CoreCheck: grew from "preN" to "n", more than double");
		ASSERT(n>preN || (n==preN && e>=preE), "CoreCheck: went from "preN" nodes, "preE" edges to "n", "e);
		for(u in corePre) ASSERT(u in S, "CoreCheck: refinement removed "u", which the BFS had found");
		ASSERT(preE==0 || preW/preE < minEdgeMean || (e>0 && w/2/e >= minEdgeMean),
		    "CoreCheck: edge mean fell from "(preE?preW/preE:0)" to "(e?w/2/e:0)", below the threshold "minEdgeMean);
		ASSERT(coreCheck!="selftest", "CoreCheck: selftest (this failure is deliberate)");
	    }
	    function highRelClusCount(u, v) { # Heuristic
		if(!(u in count) || count[u]==0) return 1;
		if(!(v in count) || count[v]==0) return 0;
		if (v in count) return count[v]/count[u]>=sqrt('$edgeDensity')*0.9; # 0.7 seems about optimal, but 0.5 to 0.9 also work well
		else return 1/count[u]>=0.5;
	    }
	    function AppendNeighbors(u,origin,    v,oldOrder) {
		oldOrder=PROCINFO["sorted_in"];
		if(u in graphletNeighbors) {
		    # The default is to append them in random order... no significant difference on small networks
		    PROCINFO["sorted_in"]="randsort";
		    for (v in graphletNeighbors[u]) {
			if(!(v in visitedQ) && (!(v in line) || line[v] > line[origin]) && highRelClusCount(u, v)) {
			    QueueAdd("Q", v);
			    visitedQ[v]=1;
			}
		    }
		    PROCINFO["sorted_in"]=oldOrder;
		}
	    }
	    END{n=length(degree); # number of nodes in the input network
		if('$edgeDensity'==1) density_leeway=1;
		else density_leeway = '$DENSITY_LEEWAY';
		# make cluster and started empty sets; started is a list of nodes we should NOT start a new BFS on
		delete cluster; cluster[0]=1; delete cluster[0];
		delete started; started[0]=1; delete started[0];
		numClus=0;
		QueueAlloc("Q");
		for(start=1; start<=int(FNR*'$edgeDensity'); start++) { # look for a cluster starting on line "start".
		    origin=node[start];
		    if(started[origin]) continue;
		    started[origin]=1;
		    MakeEmptySet(S);
		    MakeEmptySet(visitedQ);
		    misses=0; # how many nodes have been skipped because they did not work?
		    if(QueueLength("Q")>0){QueueDelloc("Q");QueueAlloc("Q");}
		    QueueAdd("Q", origin);
		    visitedQ[origin] = 1;
		    wgtEdgeCount = edgeCount = 0;
		    delete edgesIntoS; delete wgtIntoS; # maintained: number [weight] of edges from each node into S
		    while(QueueLength("Q")>0){
			u = QueueNext("Q");
			ASSERT(!(u in S),"u in S error");
			newEdgeHits = edgesIntoS[u]+0;
			wgtEdgeHits = wgtIntoS[u]+0;
			edgeCount += newEdgeHits;
			wgtEdgeCount += wgtEdgeHits;
			S[u]=1;
			Slen = length(S);
			ASSERT(Slen > 0, "Slen must be > 0 but is "Slen);
			if(Slen >= '$maxClus') { IntoS(u,1); break; }
			# CAREFUL: calling InducedEdges(S) every QueueNext() is VERY expensive; uncommenting the line below
			# slows the program by more than 100x (NOT an exaggeration)
			# WARN(edgeCount == InducedEdges(edge,S),"Slen "Slen" edgeCount "edgeCount" Induced(S) "InducedEdges(edge,S));
			Sorder[Slen]=u; # no need to delete this element if u fails because Slen will go down by 1
			if (Slen==1) {
			    IntoS(u,1);
			    AppendNeighbors(u, origin);
			} else {
			    maxEdges = choose(Slen,2);
			    if(edgeCount/maxEdges < '$edgeDensity' * density_leeway) {
				delete S[u]; # u drops the edge density too low, so nuke it
				if(edgePredict) {
				    if((edgeCount+edgePredict)/maxEdges >= '$edgeDensity') {
					# just ONE edge would put us over the threshold; predict it should exist
					numPredict=0;
					for(uu in S)if((!(uu in edge)) || !(u in edge[uu]))
					WARN(numPredict<=edgePredict,"should only get "edgePredict" new edge predictions but got "numPredict);
				    }
				}
				edgeCount -= newEdgeHits;
				wgtEdgeCount -= wgtEdgeHits;
				if(++misses > MAX(Slen, n/100)) break; # 1% of number of nodes is a heuristic...
				# keep going until count decreases significantly; remove duplicate clusters in next awk
			    } else {
				misses=0;
				IntoS(u,1);
				AppendNeighbors(u, origin);
			    }
			}
		    }
		    sorderN=length(S); # Sorder[1..sorderN] is filled; CORE refinement appends the nodes it adds
		    if(QueueLength("Q")==0 && length(S) > 1) {
			# post-process to remove nodes with too low in-cluster degree---quite relevant for lower density
			# communities where a node may be added because it does not
			# reduce the *mean* degree of the cluster, but it does not really have sufficiently strong
			# connections to the actual members of the community. We use two criteria:
			# 1) the in-cluster degree is more than 3 sigma below the mean, or
			# 2) the in-cluster degree is less than 1/3 the mode of the in-cluster degree distribution.
			# The latter was added in response to our performance on the LFR graphs, but it does not appear
			# to hurt performance anywhere else.
			StatReset(""); delete degFreq;
			DegreeInSKeys(); # snapshot of in-cluster degrees, which equal the maintained edgesIntoS
			for(v in S) { degreeInS[v]=edgesIntoS[v]+0; StatAddSample("", degreeInS[v]); ++degFreq[degreeInS[v]];}
			maxFreq=degMode=0;
			for(d=StatMax("");d>=StatMin("");d--)
			    if(d in degFreq && degFreq[d] >= maxFreq) { # use >= to extract SMALLEST mode
				maxFreq=degFreq[d]; degMode=d
			}
			PROCINFO["sorted_in"] = "@val_num_asc"; # for loop through in-degrees, smallest first
			for(v in degreeInS) {
			    if(degreeInS[v] < StatMean("") - 3*StatStdDev("") || degreeInS[v] < degMode/3) {
				RemoveFromS(v);
			    }
			}
		    }
		    DegreeInSKeys(); # snapshot; a sorted for-in fixes its key list at loop start
		    for(v in S) degreeInS[v]=edgesIntoS[v]+0;
		    PROCINFO["sorted_in"] = "@val_num_asc"; # for loop through in-degrees, smallest first
		    for(v in degreeInS) {
			if(length(S)<2) break;
			if(edgeCount / choose(length(S),2) >= '$edgeDensity') break; # break once ED is above threshsold
			RemoveFromS(v);
		    }
		    if(length(S)>1) {
			ed = edgeCount / choose(length(S),2);
			WARN(ed >= '$edgeDensity',"hmmm, ed is "ed);
		    }
		    if(coreRefine && length(S)>=2 && length(S)<maxClus && edgeCount/choose(length(S),2)>=ED) {
			oldOrder=PROCINFO["sorted_in"]; PROCINFO["sorted_in"]="";
			if(CoreCovered()) ++coreSkipped;
			else {
			    delete corePre; for(v in S) corePre[v]=1;
			    corePreN=length(S); corePreE=edgeCount; corePreW=wgtEdgeCount;
			    CoreRefine(); ++coreRefined;
			    # Put it back as the BFS found it if it grew into an earlier community, or if the nodes added (chosen
			    # without regard to edge weights) pulled its edge mean below the threshold it used to pass.
			    if(cN>corePreN && (CoreCovered() || (corePreE>0 && corePreW/corePreE>=minEdgeMean &&
							       wgtEdgeCount/edgeCount<minEdgeMean))) {
				++coreReverted; delete coreGone; for(v in S) if(!(v in corePre)) coreGone[v]=1;
				for(v in coreGone) CoreDrop(v);
			    }
			    if(coreCheck) CoreCheck(corePreN, corePreE, corePreW);
			    for(v in S) if(!(v in corePre)) Sorder[++sorderN]=v;
			    if(length(S)>=minClus) for(v in S) coreNodeClus[v][coreRefined]=1;
			}
			PROCINFO["sorted_in"]=oldOrder;
		    }
		    Slen=length(S);
		    if(Slen>=minClus && wgtEdgeCount/edgeCount>='$minEdgeMean') {
			maxEdges=choose(Slen,2);
			++numClus; printf "%d %d %g", Slen, edgeCount, wgtEdgeCount
			StatReset("");
			# Print nodes in deterministic order so that duplicate clusters can easily be removed later
			oldOrder=PROCINFO["sorted_in"]; PROCINFO["sorted_in"]="@ind_str_asc";
			for(u in S) {
			    cluster[numClus][u]=1; printf " %s", u;
			}
			PROCINFO["sorted_in"]=oldOrder;
			print "";
			# now mark as "started" the first half of S that was filled... or more generally, some fraction.
			# We choose the top (1-OVERLAP) fraction because OVERLAP is meant to be less stringent as it
			# approaches 1, which in the case of THIS loop means that if OVERLAP is close to 1, we want
			# to eliminate a SMALLER proportion (ie., allow more) of future BFS starts, so if OVERLAP=1,
			# we eliminate NOTHING in this loop.
			for(i=1;i<Slen*(1-'$OVERLAP');i++) started[Sorder[i]]=1;
		    }
		}
		if('$VERBOSE' && coreRefine)
		    printf "CORE refinement: %d refined, %d skipped (already covered), %d reverted, %d region rounds, %d rounds undone\n",
			coreRefined, coreSkipped, coreReverted, coreRounds, coreUndone >"/dev/stderr"
	    }' "$TMPDIR/net4awk.el$W" - | # dash is the output of the above pipe (sorted cluster counts)
	sort -T $TMPDIR -nr |
	hawk ' # remove duplicate clusters
	    BEGIN{ numClus=0 } # post-process to only EXACT duplicates (more general removal later)
	    FNR>1 && '$ONLY_ONE'{exit}
	    {
		# only record a cluster the first time we see it
		if(++seen[$0]==1) printf "'$k' %s\n", $0
	    }' | # sort by number of nodes, then by first node in the list:
	sort -T $TMPDIR $SUBFINAL_SORT > $TMPDIR/subfinal$k$edgeDensity.out & # perform sort in the background
    done
    for k in "${Ks[@]}"; do
	wait; (( BLANT_EXIT_CODE += $? ))
    done
done

# we can use the --merge option because the subfinal files are already sorted in SUBFINAL_SORT order
sort -T $TMPDIR --merge $SUBFINAL_SORT $TMPDIR/subfinal*.out |
    hawk 'BEGIN{ numClus=0 } # post-process to remove/merge duplicates
	{
	    ASSERT(NF>4, "expecting at least 4 node after n m es k");
	    delete S;
	    k=$1;
	    numNodes=$2
	    edgeHits=$3;
	    edgeWgts=$4;
	    for(i=5;i<=NF;i++) ++S[$i]
	    WARN(length(S)==numNodes,"mismatch(2) in numNodes and length(S)");
	    add=1;
	    delete cand;
	    for(u in S) if(u in nodeClus) for(c in nodeClus[u]) cand[c]=1;
	    for(c in cand) {
		same=0;
		for(u in S) if(u in cluster[c])++same;
		if(same > length(S)*'$OVERLAP'){ add=0; break;} # we check ONLY if $OVERLAP fraction of the NEW cluster
		# overlaps any one old cluster... it is TOTALLY ALLOWED to completely overlap the old cluster if it is
		# lower density, for example.
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
		    100*edges[i]/maxEdges, kk[i]
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
