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
export LC_ALL=C # byte-order sort and awk; sort is ~10x faster than with a UTF-8 locale

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
Ks=(`echo $2 | newlines | sort -nru`); # sort the (unique) Ks highest to lowest so the below parallel runs start the higher values of k first
#[ `echo "${Ks[@]}" | wc -w` -eq 1 ] || die "no more multiple K's at the same time"
EDs=(`echo $3 | newlines | awk '!seen[$0]++'`) # unique: duplicate edgeDensities would collide on their files
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

for k in "${Ks[@]}"; do
  ( # one subshell per k: read the BLANT output once, sending each item to every edgeDensity it has enough edges for
    minEdges=()
    for edgeDensity in "${EDs[@]}"; do
	minEdges+=(`awk "BEGIN{edC=$edgeDensity*($k*($k-1)/2); rounded_edC=int(edC);
	    if(rounded_edC == edC) --rounded_edC; # allow one edge less than eps
	    print (rounded_edC > $k-1 ? rounded_edC : $k-1)}"`)
	mkfifo $TMPDIR/counts$k.$edgeDensity
    done
    hawk ' # This first awk just splits the BLANT output among the edgeDensities; it uses minimal RAM and CPU
	BEGIN{ onlyBestOrbit='$ONLY_BEST_ORBIT';
	    cMode="'$COMMUNITY_MODE'"; if(cMode=="") cMode=="g"; # graphlet uses FAR less RAM
	    ASSERT(cMode=="g" || cMode=="o", "COMMUNITY_MODE must be o or g, not "cMode);
	    nED=split("'"${minEdges[*]}"'", minE); split("'"${EDs[*]}"'", ED);
	    minEdges=minE[1]; for(i=1;i<=nED;i++) { out[i]="'$TMPDIR/counts$k.'"ED[i]; if(minE[i]<minEdges) minEdges=minE[i] }
	    for(i=1;i<=nED;i++) printf "" > out[i]; # open every FIFO now, else a reader with no lines would wait forever
	}
	ARGIND==1 && FNR>1 && $2 {canonEdges[FNR-2]=$3}
	ARGIND==2 && FNR>1 && ((FNR-2) in canonEdges) {for(i=1;i<=NF;i++)orbit2canon[$i]=FNR-2}
	END { # getline skips the per-line misc.awk DOS check, which is pointless on BLANT output
	    f="'$BLANT_FILES/blant$k.out'";
	    while((r=(getline < f)) > 0) {
		if($3<=0) continue; # ensure the actual count is nonzero
		if(cMode=="o") {
		    orbit=$2; canon=orbit2canon[orbit]; edges=canonEdges[canon]; if(edges<minEdges) continue;
		    item=orbit;
		} else if(cMode=="g") {
		    canon=$2; edges=canonEdges[canon]; if(edges<minEdges) continue;
		    item=canon;
		}
		# the neighbors stay raw text (repeats are dropped by the build awk). BLANT writes
		# "u canon count<TAB>neighbors"; the regex is a fallback for other spacing
		p=index($0, "\t"); if(p) nb=substr($0, p); else { nb=$0; sub(/^[ \t]*[^ \t]+[ \t]+[^ \t]+[ \t]+[^ \t]+/, "", nb) }
		if(onlyBestOrbit) { # item=0: sum the counts of all the items of each node, separately per edgeDensity
		    for(i=1;i<=nED;i++) if(edges>=minE[i]) { Kc[i][$1]+=$3; Nb[i][$1]=Nb[i][$1] nb }
		    continue;
		}
		# BLANT prints each (node, item) once, so there is no count to sum
		ASSERT(!(($1,item) in seen), "node "$1" item "item" appears twice in the BLANT output"); seen[$1,item]=1;
		s = ($3+0) " " $1 " " item nb;
		for(i=1;i<=nED;i++) if(edges>=minE[i]) print s > out[i];
	    }
	    ASSERT(r==0, "cannot read "f);
	    for(i in Kc) for(u in Kc[i]) print Kc[i][u], u, 0 Nb[i][u] > out[i];
	}' canon_maps/canon_list$k.txt canon_maps/orbit_map$k.txt &
    for edgeDensity in "${EDs[@]}"; do
	if [ $SQR_NORM = 1 ]; then # normalize by the total count of all items kept
	    hawk '{T[$2]+=$1; L[NR]=$0} END{for(i=1;i<=NR;i++) {$0=L[i]; $1=$1^2/T[$2]; print}}'
	else cat
	fi < $TMPDIR/counts$k.$edgeDensity |
	sort -T $TMPDIR -gr | # sorted [weighted] cluster-counts of all the nodes, largest-to-smallest
	hawk ' # build the actual communities; may require huge amounts of RAM and CPU, eg 10GB and 12-24h for 9wiki-topcats
	    BEGIN{if("'$RANDOM_SEED'") srand('$RANDOM_SEED');else Srand();OFS="\t"; ID=0; edgePredict='"$EDGE_PREDICT"';
		hrTh = sqrt('$edgeDensity')*0.9; # highRelClusCount threshold, constant over the run
	    }
	    ARGIND==1{ # get the edge list [and weights if present]
		mLines=FNR; # edge count, used by minClus in END
		if(NF==2)weight=1; else if(NF==3)weight=$3; else ASSERT(0, "expecting either 2 or 3 columns");
		if(weight!=1) weighted=1;
		if(!weight || $1==$2) dirty=1; # see badEdge in END
		if(!($1 in edge)) ++nNodes;
		edge[$1][$2]=weight;
		if(!($2 in edge)) ++nNodes;
		edge[$2][$1]=weight;
	    }
	    function readCounts() { # the sorted cluster counts on stdin
		while((getline < "-") > 0) { # && !($2 in count) # uncomment to take only first occurence--faster but worse result
		    item=$3; count[$2]+=$1; node[++nL]=$2; line[$2]=nL;
		    if(NF>=4) gnRow($2, graphletNeighbors[$2], edge[$2]); # function call: sub-array params are faster to index
		}
	    }
	    function gnRow(u, gu, eu,    i, x) {
		for(i=4; i<=NF; i++) { x=$i; if(!(x in gu)) {
		    if(!(x in eu)) dirty=1; # the lookup below auto-creates edge[u][x]; see badEdge in END
		    if(eu[x] > '$minEdgeMean'/2) { gu[x]=1; graphletNeighbors[x][u]=1 } # heuristic: avoid too-weak edges
		} }
	    }

	    # inD(v) counts the w in S, w!=v, with (v in edge[w]), and sets inW to their weight, by scanning whichever is
	    # shorter: edge[v] or SL[1..Slen]. The edge[v] scan misses only one-sided edge[w][v], which the ASSERTs below fail on.
	    function inD(v, ev,    c,j,w) { # ev must be edge[v]
		c=inW=0;
		# if !dirty, edge[] is symmetric with no self-loops, so (w in ev) == (v in edge[w]) and w!=v
		if(length(ev) <= Slen) {
		    if(!dirty && !weighted) { for(w in ev) if(w in S) c++ }
		    else for(w in ev) if(w!=v && (w in S) && (v in edge[w])) { c++; if(weighted) inW+=edge[w][v] }
		} else if(!dirty && !weighted) {
		    for(j=1;j<=Slen;j++) if(SL[j] in ev) c++; # numeric index is ~1.8x faster than for-in
		} else {
		    for(j=1;j<=Slen;j++) { w=SL[j]; if(w!=v && (v in edge[w])) { c++; if(weighted) inW+=edge[w][v] } }
		}
		if(!weighted) inW=c;
		return c;
	    }
	    function addToS(u) { S[u]=1; SL[++Slen]=u; SI[u]=Slen }
	    function removeFromS(u,    w) {
		w=SL[Slen]; SL[SI[u]]=w; SI[w]=SI[u]; Slen--;
		delete S[u];
	    }
	    function fillDegreeInS(    u) { # populate degreeInS with the in-cluster degrees of the members of S
		MakeEmptySet(degreeInS);
		for(u in S) degreeInS[u] = inD(u, edge[u]);
	    }
	    function AppendNeighbors(u,    v,n,f,i,j,t) { # lo = line[origin], set per BFS in END
		# gnL[u] is pre-filtered by highRelClusCount and ordered by line descending (see END), so we can stop
		# at the first v with line[v] <= lo. The default is to append them in random order... no significant
		# difference on small networks; Fisher-Yates shuffle the survivors, O(deg) rand() calls.
		n=gnN[u]+0; f=qL+1;
		for(i=1;i<=n;i++) {
		    v=gnL[u][i];
		    if((v in line) && line[v] <= lo) break;
		    if(!(v in visitedQ)) { qv[++qL]=v; visitedQ[v]=1 }
		}
		for(i=qL; i>f; i--) { j=f+int(rand()*(i-f+1)); t=qv[i]; qv[i]=qv[j]; qv[j]=t }
	    }
	    END{readCounts(); n=nNodes; # number of nodes in the input network
		M=1*'$minClusArg'; if(M>=1) minClus=M;
		else {
		    m=mLines; eps=m/choose(n,2);
		    if(M>0)pVal=M;else pVal=1/choose(n,2)^2; # heuristic to make pVal small enough to get significant clusters
		    for(e=1;e<m;e++)if(eps^e<pVal) break;
		    for(minClus=2;minClus<n;minClus++) if('$edgeDensity'*choose(minClus,2)>=e) break;
		    if('$VERBOSE') printf "minClus %d (%d edges = pVal %g < %g for ED %g)\n", minClus, e, eps^e, pVal, eps >"/dev/stderr"
		}
		ASSERT(minClus>=1,"minClus "minClus" must be >=1");
		if('$edgeDensity'==1) density_leeway=1;
		else density_leeway = '$DENSITY_LEEWAY';
		edThr = '$edgeDensity' * density_leeway;
		# badEdge/asymEdge/loopEdge hold the entries the old EdgesIntoS/InducedEdges asserted on (zero weight,
		# self-loop, or one-sided auto-created key), so inD can skip them and still fail at the same points.
		if(dirty) for(u in edge) for(v in edge[u]) {
		    if(u==v) loopEdge[u]=1;
		    else if(!(v in edge) || !(u in edge[v])) { badEdge[v][++badN[v]]=u; asymEdge[u][++asymN[u]]=v }
		    else if(!edge[v][u]) badEdge[v][++badN[v]]=u;
		}
		# gnL[u] = graphlet neighbors v of u that pass the highRelClusCount heuristic (cu==0, or count[v]/cu>=hrTh,
		# where cu=count[u]), with the v that have no line first, then by line descending. (v in line) == (v in count).
		for(u in graphletNeighbors) {
		    cu = CU[u] = (u in count) ? count[u] : 0;
		    if(cu==0) for(v in graphletNeighbors[u]) if(!(v in line)) gnL[u][++gnN[u]]=v;
		}
		for(l=nL; l>=1; l--) { v=node[l]; if(line[v]==l && (v in graphletNeighbors)) {
		    cv=count[v];
		    for(u in graphletNeighbors[v]) { cu=CU[u]; if(cu==0 || (cv!=0 && cv/cu>=hrTh)) gnL[u][++gnN[u]]=v } # graphletNeighbors is symmetric
		} }
		delete graphletNeighbors; delete CU;
		# make cluster and started empty sets; started is a list of nodes we should NOT start a new BFS on
		delete cluster; cluster[0]=1; delete cluster[0];
		delete started; started[0]=1; delete started[0];
		numClus=0;
		qF=1; qL=0;
		for(start=1; start<=int(nL*'$edgeDensity'); start++) { # look for a cluster starting on line "start".
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
		    Slen=0;
		    lo = line[origin];
		    while(qL>=qF){
			u = qv[qF++];
			if(u in S) ASSERT(0,"u in S error");
			if(u in badN) for(j=1;j<=badN[u];j++) ASSERT(!(badEdge[u][j] in S),"edge error");
			newEdgeHits = inD(u, edge[u]);
			wgtEdgeHits = inW;
			# CAREFUL: calling InducedEdges(S) every QueueNext() is VERY expensive; uncommenting the line below
			# slows the program by more than 100x (NOT an exaggeration)
			# WARN(edgeCount == InducedEdges(edge,S),"Slen "Slen" edgeCount "edgeCount" Induced(S) "InducedEdges(edge,S));
			# Test u BEFORE adding it: most candidates are rejected, and then u never has to be removed from S.
			n1 = Slen+1; maxEdges = n1*(n1-1)/2;
			if(n1==1 || n1 >= '$maxClus' || (edgeCount+newEdgeHits)/maxEdges >= edThr) {
			    edgeCount += newEdgeHits;
			    wgtEdgeCount += wgtEdgeHits;
			    addToS(u);
			    if(Slen >= '$maxClus') break;
			    Sorder[Slen]=u;
			    misses=0;
			    AppendNeighbors(u);
			} else { # u drops the edge density too low, so never add it
				if(edgePredict) {
				    if((edgeCount+newEdgeHits+edgePredict)/maxEdges >= '$edgeDensity') {
					# just ONE edge would put us over the threshold; predict it should exist
					numPredict=0;
					for(uu in S)if(!(u in edge[uu]))
					    #printf "predictEdge-%d\t%s\t%s\n",++numPredict, u,uu > "/dev/stderr"
					WARN(numPredict<=edgePredict,"should only get "edgePredict" new edge predictions but got "numPredict);
				    }
				}
				if(++misses > MAX(n1, n/100)) break; # n1=|S|+u: the old code measured S with u in it
				# keep going until count decreases significantly; remove duplicate clusters in next awk
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
				edgeCount -= inD(v, edge[v]);
				wgtEdgeCount -= inW;
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
			edgeCount -= inD(v, edge[v]);
			wgtEdgeCount -= inW;
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
	' "$TMPDIR/net4awk.el$W" | # stdin is the output of the above pipe (sorted cluster counts)
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
    wait
  ) &
done
# all (edgeDensity, k) pipelines are independent, so they all run in parallel
# ponytail: one process per (edgeDensity, k), so peak RAM is that many network copies; cap the jobs if that hurts
wait

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
