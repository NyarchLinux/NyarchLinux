#coding=utf-8

def gan( list1, list2, accuracy=0.00001 ):
    def meiju(i):
        if i == len(list1):
            #print "##########"
            #for k in range(i): print result_list[k]
            #print "_____"
            #print list2
            #print test_result
            #print "##########"
            return "suc"

        else:
            for x in range(len(list2)):
                result_list[i] = x
                if test_result[x] + list1[i] <= list2[x]+ accuracy:
                    test_result[x] = test_result[x] + list1[i]
                    reback = meiju( i+1 )
                    test_result[x] = test_result[x] - list1[i]
                    if reback == "suc":
                        return "suc"
    result_list = [-1] * len(list1)
    test_result = [0] * len(list2)
    meiju(0)
    #print result_list
    return result_list




