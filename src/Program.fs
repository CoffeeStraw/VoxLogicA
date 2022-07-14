// Copyright 2018 Vincenzo Ciancia.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// A copy of the license is available in the file "Apache_License.txt".
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// ltsinfo
// ltsgraph

module VoxLogicA.Main
open System.Reflection
open Argu

exception CommandLineException 
    with override __.Message = "Invalid arguments. Usage:\nVoxLogicA <FILENAME>"

type LoadFlags = {
    fname : string;
    numCores : int
}

type CmdLine = 
    | Ops 
    | Sequential
    | Convert of string * string    
    | [<MainCommandAttribute;UniqueAttribute>] Filename of string    
with
    interface Argu.IArgParserTemplate with
        member s.Usage =
            match s with
            | Ops ->  "display a list of all the internal operators, with their types and a brief description"
            | Filename _ -> "VoxLogicA session file"
            | Convert _ ->  "Convert from/to image, json, aut (mcrl2)"
            | Sequential ->  "Run on one CPU only"

let (|Img|_|) (s : string) =
    match System.IO.Path.GetExtension s with
    | (".png"|".jpg"|".bmp"|".nii.gz"|".nii") -> Some Img
    | _ -> None

let (|JSon|_|) (s : string) =
    match System.IO.Path.GetExtension s with
    | ".json" -> Some JSon
    | _ -> None

let (|Aut|_|) (s: string) =
    match System.IO.Path.GetExtension s with
    | ".aut" -> Some Aut
    | _ -> None
    
[<EntryPoint>]
let main (argv : string array) =
    let name = Assembly.GetEntryAssembly().GetName()
    let version = name.Version 
    let informationalVersion = ((Assembly.GetEntryAssembly().GetCustomAttributes(typeof<AssemblyInformationalVersionAttribute>, false).[0]) :?> AssemblyInformationalVersionAttribute).InformationalVersion
    ErrorMsg.Logger.Debug (sprintf "%s %s" name.Name informationalVersion)
    let model = SITKModel() :> IModel   
    let checker = ModelChecker(model)          
    if version.Revision <> 0 then ErrorMsg.Logger.Warning (sprintf "You are using a PRERELEASE version of %s. The most recent stable release is %d.%d.%d." name.Name version.Major version.Minor version.Build)                        
    try
        let cmdLineParser = ArgumentParser.Create<CmdLine>(programName = name.Name, errorHandler = ProcessExiter())     
        let parsed = cmdLineParser.Parse argv  
        
        if parsed.Contains Ops
        then 
            Seq.iter (fun (op : Operator) -> printfn "%s" <| op.Show()) checker.OperatorFactory.Operators
            exit 0
        if parsed.Contains Convert then          
            let s1,s2 = parsed.GetResult Convert
            match s1,s2 with                
            | Img,JSon ->
                let (imgf,jsonf) = (s1,s2)
                let img = new SITKUtil.VoxImage(imgf)                  
                if img.NComponents < 3 then failwith "Image must be RGB or RGBA"
                let s = 
                    let t = img.Size
                    if Array.length t = 3 then t 
                    else Array.append t [| 1 |]
                img.GetBufferAsFloat (fun buf ->
                    System.IO.File.WriteAllText(jsonf,FSharp.Json.Json.serialize {  
                        Graph.nodes = List.ofSeq <| seq { 
                            for i in 0..(s.[0]-1) do 
                            for j in 0..(s.[1]-1) do 
                            for k in 0..(s.[2]-1) do { 
                                Graph.id = string (i,j,k);                                
                                Graph.atoms = [ 
                                    let start = img.NComponents * (i + (j*s.[0]) + (k*s.[1]))
                                    let r = buf.Get start
                                    let g = buf.Get (start+1)
                                    let b = buf.Get (start+2)
                                    sprintf "#%02X%02X%02X" (int r) (int g) (int b)
                                    ] 
                            } 
                        };
                        Graph.arcs = List.ofSeq <| seq { 
                            for i in 0..(s.[0]-1) do 
                            for j in 0..(s.[1]-1) do 
                            for k in 0..(s.[2]-1) do                            
                            for a in -1..1 do
                            for b in -1..1 do
                            for c in -1..1 do
                            let d = i+a
                            let e = j+b
                            let f = k+c
                            // if 0 <= d && d < s.[0] && 0 <= e && e < s.[1] && 0 <= f && f < s.[2] then { 
                            if (List.length (List.filter (fun x -> x <> 0) [a;b;c])) = 1 && 0 <= d && d < s.[0] && 0 <= e && e < s.[1] && 0 <= f && f < s.[2] then { 
                                Graph.source = string (i,j,k); 
                                Graph.target = string (d,e,f)
                            }
                        }
                    })                 
                )
            | JSon,Img ->
                let j = Graph.loadFileGraph(s1)
                let parseTriple s = 
                    let reg = new System.Text.RegularExpressions.Regex "^\s*\((\s*[0-9]+\s*),(\s*[0-9]+\s*),(\s*[0-9]+\s*)\)\s*$"
                    let m = reg.Match s
                    if m.Success 
                    then [|int m.Groups[1].Value;int m.Groups[2].Value;int m.Groups[3].Value|]
                    else failwith $"Not a triple: {s}"

                let parseColour s =
                    let reg = new System.Text.RegularExpressions.Regex "^\s*#([0-9a-fA-F][0-9a-fA-F])([0-9a-fA-F][0-9a-fA-F])([0-9a-fA-F][0-9a-fA-F])\s*$"
                    let m = reg.Match s
                    let f x = System.Int32.Parse(x, System.Globalization.NumberStyles.HexNumber)
                    if m.Success
                    then [|f m.Groups[1].Value;f m.Groups[2].Value;f m.Groups[3].Value|]
                    else failwith $"Not a colour: {s}"
                
                let nodes = 
                    seq { for n in j.nodes do
                            yield (parseTriple n.id,parseColour n.atoms[0]) }
                let maxdim i = 
                    let fn (x : array<int> * array<int>) =                             
                        let coords = fst x
                        coords[i]+1
                    (Seq.max (Seq.map fn nodes))                        
                let md = [| for i in 0..2 do maxdim i |]   
                let sz = if md[2] <= 1 then 1 else 2              
                let img = new SITKUtil.VoxImage(new itk.simple.Image(new itk.simple.VectorUInt32(Array.map uint32 md),itk.simple.PixelIDValueEnum.sitkVectorUInt8,uint32 4))
                img.GetBufferAsUInt8 (fun buf ->
                    for (coords,colour) in nodes do
                        let linearCoord = coords[0] + (coords[1] * md[0]) + (coords[2] * md[1] * md[0])
                        for colourId in [0..2] do
                            buf.Set (linearCoord + colourId) (uint8 colour[colourId])
                        buf.Set (linearCoord + 3) 255uy
                )
                img.Save s2
            | JSon,Aut ->
                let j = Graph.loadFileGraph(s1)
                let nodeOfId = new System.Collections.Generic.Dictionary<_,_>()
                List.iteri (fun i (v : Graph.IntNode) -> nodeOfId[v.id] <- {| index = i; node = v|}) j.nodes
                let n = j.nodes.Length
                let transitions = new System.Collections.Generic.HashSet<_>() 
                let addTransition t = ignore <| transitions.Add t
                for a in j.arcs do
                    let src = nodeOfId[a.source]
                    let tgt = nodeOfId[a.target]
                    let condition = (List.sort (src.node.atoms)) = (List.sort (tgt.node.atoms))
                    addTransition (src.index,(if condition then "tau" else "change"),tgt.index)
                    addTransition (tgt.index+n,(if condition then "tau" else "change"),src.index+n)
                for kv in nodeOfId do
                    let idx = kv.Value.index
                    for atom in kv.Value.node.atoms do
                        addTransition (idx,atom,idx)
                    addTransition (idx,"l1",idx+n)
                    addTransition (idx+n,"l2",idx)                    
                let sw = new System.IO.StreamWriter(s2)
                fprintfn sw "des (0,%A,%A)" transitions.Count (2*n)
                for t in transitions do                    
                    fprintfn sw "%A" t
                sw.Close()                                 
                exit 0
                
            | _,_ ->
                    failwith "wrong file exensions for conversion"
            ErrorMsg.Logger.Debug "Conversion done."
            exit 0
            
        let sequential = parsed.Contains Sequential        
        // if sequential
        // then 
        //     let proc = System.Diagnostics.Process.GetCurrentProcess()
        //     proc.ProcessorAffinity <- nativeint 0x1          
        let run filename =
            let interpreter = Interpreter(model,checker)
            interpreter.Batch sequential interpreter.DefaultLibDir filename    
        match (parsed.TryGetResult Filename,ErrorMsg.isDebug()) with 
            | None,false ->                                      
                printfn "%s\n" (cmdLineParser.PrintUsage ())
                0
            | Some filename,_ -> 
                run filename
                0
            | None,true ->
                run "test.imgql"
                0
    with e ->        
            ErrorMsg.Logger.DebugExn e
            ErrorMsg.Logger.Failure "exiting."
            1
